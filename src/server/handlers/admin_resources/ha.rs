#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HaPromoteRequest {
    force: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HaRecoveryImportRequest {
    batch_id: Option<String>,
    source_node_id: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HaSnapshotUploadQuery {
    source_node_id: Option<String>,
    generated_at: Option<i64>,
}

async fn get_admin_ha_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<tavily_hikari::HaStatusView>, (StatusCode, String)> {
    if !is_admin_request(state.as_ref(), &headers) {
        return Err((StatusCode::FORBIDDEN, "forbidden".to_string()));
    }
    Ok(Json(state.ha.status().await))
}

async fn get_admin_ha_snapshot(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Response<Body>, (StatusCode, String)> {
    if !is_admin_request(state.as_ref(), &headers) {
        return Err((StatusCode::FORBIDDEN, "forbidden".to_string()));
    }
    let Some(db_path) = state.ha.database_path() else {
        return Err((
            StatusCode::PRECONDITION_FAILED,
            "HA database path is not configured".to_string(),
        ));
    };

    state
        .proxy
        .ha_wal_checkpoint()
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    let bytes = tokio::fs::read(&db_path)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    let status = state.ha.status().await;
    let manifest = tavily_hikari::HaSnapshotManifest {
        source_node_id: status.node_id,
        generated_at: Utc::now().timestamp(),
        wal_checkpoint: true,
        size_bytes: bytes.len() as u64,
        sha256: tavily_hikari::sha256_hex_bytes(&bytes),
    };
    let manifest_json = serde_json::to_string(&manifest)
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    state
        .proxy
        .persist_ha_sync_watermark(
            "snapshot_export",
            Some(&manifest.source_node_id),
            None,
            manifest.generated_at,
            Some(&manifest_json),
        )
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, "application/octet-stream")
        .header("x-ha-snapshot-manifest", manifest_json)
        .body(Body::from(bytes))
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))
}

async fn put_admin_ha_snapshot(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HaSnapshotUploadQuery>,
    body: Bytes,
) -> Result<Json<tavily_hikari::HaSnapshotManifest>, (StatusCode, String)> {
    if !is_admin_request(state.as_ref(), &headers) {
        return Err((StatusCode::FORBIDDEN, "forbidden".to_string()));
    }
    let role = state.ha.role().await;
    if role != tavily_hikari::HaNodeRole::Standby {
        return Err((
            StatusCode::CONFLICT,
            format!("snapshot import requires standby role, current role is {role:?}"),
        ));
    }
    let Some(db_path) = state.ha.database_path() else {
        return Err((
            StatusCode::PRECONDITION_FAILED,
            "HA database path is not configured".to_string(),
        ));
    };
    let tmp_path = db_path.with_extension("db.ha-import");
    tokio::fs::write(&tmp_path, &body)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    let restored_tables = state
        .proxy
        .restore_ha_snapshot_file(&tmp_path)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    let _ = tokio::fs::remove_file(&tmp_path).await;

    let source_node_id = query
        .source_node_id
        .unwrap_or_else(|| "active".to_string());
    let generated_at = query.generated_at.unwrap_or_else(|| Utc::now().timestamp());
    let manifest = tavily_hikari::HaSnapshotManifest {
        source_node_id,
        generated_at,
        wal_checkpoint: false,
        size_bytes: body.len() as u64,
        sha256: tavily_hikari::sha256_hex_bytes(&body),
    };
    let manifest_json = serde_json::to_string(&manifest)
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    state
        .proxy
        .persist_ha_sync_watermark(
            "snapshot_import",
            Some(&manifest.source_node_id),
            Some(&state.ha.status().await.node_id),
            generated_at,
            Some(&format!(
                "{{\"restoredTables\":{restored_tables},\"manifest\":{manifest_json}}}"
            )),
        )
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;

    Ok(Json(manifest))
}

async fn get_public_ha_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<tavily_hikari::HaStatusView>, (StatusCode, String)> {
    let mut status = state.ha.status().await;
    status.edgeone_expected_origin = None;
    Ok(Json(status))
}

async fn post_admin_ha_promote(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<HaPromoteRequest>,
) -> Result<Json<tavily_hikari::HaStatusView>, (StatusCode, String)> {
    if !is_admin_request(state.as_ref(), &headers) {
        return Err((StatusCode::FORBIDDEN, "forbidden".to_string()));
    }
    let before = state.ha.status().await;
    let result = state
        .ha
        .promote_self_to_provisional(payload.force.unwrap_or(false))
        .await;
    let status = result.map_err(|err| (StatusCode::CONFLICT, err))?;
    let operation = tavily_hikari::HaFailoverOperationRecord {
        operation_id: format!("promote-{}-{}", status.node_id, Utc::now().timestamp()),
        operation_kind: "promote".to_string(),
        target_node_id: Some(status.node_id.clone()),
        from_origin: before.edgeone_origin,
        to_origin: status.node_public_origin.clone(),
        status: "provisional_master".to_string(),
        message: status.message.clone(),
    };
    state
        .proxy
        .insert_ha_failover_operation(&operation)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    state
        .proxy
        .persist_ha_node_state(
            &status.node_id,
            status.role,
            status.edgeone_origin.as_deref(),
            status.message.as_deref(),
        )
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    Ok(Json(status))
}

async fn post_admin_ha_finalize(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<tavily_hikari::HaStatusView>, (StatusCode, String)> {
    if !is_admin_request(state.as_ref(), &headers) {
        return Err((StatusCode::FORBIDDEN, "forbidden".to_string()));
    }
    let status = state
        .ha
        .finalize_failover()
        .await
        .map_err(|err| (StatusCode::CONFLICT, err))?;
    state
        .proxy
        .persist_ha_node_state(
            &status.node_id,
            status.role,
            status.edgeone_origin.as_deref(),
            status.message.as_deref(),
        )
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    Ok(Json(status))
}

async fn post_admin_ha_recovery_import(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<HaRecoveryImportRequest>,
) -> Result<Json<tavily_hikari::HaRecoveryImportResult>, (StatusCode, String)> {
    if !is_admin_request(state.as_ref(), &headers) {
        return Err((StatusCode::FORBIDDEN, "forbidden".to_string()));
    }
    let batch = payload.batch_id.unwrap_or_else(|| "manual".to_string());
    let source = payload.source_node_id.unwrap_or_else(|| "unknown".to_string());
    let message = payload
        .message
        .unwrap_or_else(|| format!("recovery batch {batch} imported from {source}"));
    let checksum = tavily_hikari::sha256_hex_bytes(message.as_bytes());
    let imported = state
        .proxy
        .claim_ha_recovery_batch(&batch, &source, 1, &checksum)
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    if imported {
        state
            .proxy
            .rebuild_ha_recovery_rollups()
            .await
            .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
        state
            .proxy
            .complete_ha_recovery_batch(&batch, "imported", 1)
            .await
            .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    }
    let status = state.ha.enter_recovery(message.clone()).await;
    state
        .proxy
        .persist_ha_node_state(
            &status.node_id,
            status.role,
            status.edgeone_origin.as_deref(),
            status.message.as_deref(),
        )
        .await
        .map_err(|err| (StatusCode::INTERNAL_SERVER_ERROR, err.to_string()))?;
    Ok(Json(tavily_hikari::HaRecoveryImportResult {
        batch_id: batch,
        source_node_id: source,
        imported,
        event_count: 1,
        checksum,
        message,
        status,
    }))
}
