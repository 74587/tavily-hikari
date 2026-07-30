use super::*;
use super::core_support_and_parsing::*;
use super::upstream_support_and_manual_jobs::*;

#[tokio::test]
async fn admin_ha_node_detail_omits_current_node_edgeone_settings() {
    let peer_listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind peer listener");
    let peer_addr = peer_listener.local_addr().expect("peer addr");
    tokio::spawn(async move {
        let app = Router::new().route(
            "/api/internal/ha/status",
            get(|| async {
                Json(json!({
                    "mode": "active_standby",
                    "nodeId": "node-peer",
                    "nodePublicOrigin": "peer-public-origin:443",
                    "role": "standby",
                    "dualActiveEnabled": false,
                    "fullMasterNodeId": null,
                    "degraded": false,
                    "allowsBasicBusiness": true,
                    "allowsFullWrites": false,
                    "edgeoneDomain": "peer-edgeone.example.com",
                    "edgeoneOrigin": "peer-live-route:443",
                    "edgeoneExpectedOrigin": "peer-source-config:53844",
                    "edgeoneCurrentTarget": "peer-live-route:443",
                    "edgeoneExpectedTarget": "peer-source-config:53844",
                    "edgeoneCurrentSourceKind": "direct",
                    "edgeoneExpectedSourceKind": "direct",
                    "edgeoneCurrentOriginGroupId": null,
                    "edgeoneExpectedOriginGroupId": null,
                    "haSourceDefaults": null,
                    "haSourceOverride": null,
                    "haSourceEffective": {
                        "sourceKind": "direct",
                        "directOriginScheme": "https",
                        "directOriginHost": "peer-source-config",
                        "directOriginPort": 53844,
                        "originGroupId": null,
                        "target": "peer-source-config:53844"
                    },
                    "edgeoneApiConfigured": true,
                    "lastEdgeoneCheckAt": 1_700_000_000,
                    "lastSyncAt": 1_700_000_001,
                    "syncLagSeconds": 1,
                    "recoveryStatus": null,
                    "message": "peer ready",
                    "peerNodes": [],
                    "plannedCutoverEligible": true
                }))
            }),
        );
        axum::serve(peer_listener, app.into_make_service())
            .await
            .expect("serve peer status");
    });

    let db_path = temp_db_path("ha-node-detail-peer-scope");
    let db_str = db_path.to_string_lossy().to_string();
    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-ha-node-detail-peer-scope".to_string()],
        DEFAULT_UPSTREAM,
        &db_str,
    )
    .await
    .expect("proxy created");
    let ha = tavily_hikari::HaRuntime::new(tavily_hikari::HaConfig {
        mode: tavily_hikari::HaMode::ActiveStandby,
        node_id: "node-active".to_string(),
        database_path: Some(db_str.clone()),
        source_kind: Some(tavily_hikari::HaSourceKind::Direct),
        node_public_scheme: Some("https".to_string()),
        node_public_host: Some("active-source-config".to_string()),
        node_public_port: Some(1443),
        edgeone_domain: Some("active-edgeone.example.com".to_string()),
        edgeone_expected_origin_scheme: Some("https".to_string()),
        edgeone_expected_origin_host: Some("active-source-config".to_string()),
        edgeone_expected_origin_port: Some(1443),
        internal_token: Some("peer-token".to_string()),
        peer_nodes: vec![tavily_hikari::HaPeerNodeConfig {
            node_id: "node-peer".to_string(),
            admin_base_url: format!("http://{peer_addr}"),
            public_origin: "peer-public-origin:443".to_string(),
            role_hint: tavily_hikari::HaPeerRoleHint::StandbyCandidate,
        }],
        ..tavily_hikari::HaConfig::default()
    });
    let addr = spawn_ha_admin_server(proxy, ha, true).await;

    let response = Client::new()
        .get(format!("http://{addr}/api/admin/ha/nodes/node-peer"))
        .send()
        .await
        .expect("node detail response");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: Value = response.json().await.expect("node detail body");
    assert_eq!(body["currentNodeId"], "node-active");
    assert_eq!(body["node"]["nodeId"], "node-peer");
    assert!(body["timeline"]["events"].is_array());
    for local_setting in [
        "edgeoneDomain",
        "edgeoneCurrentTarget",
        "edgeoneCurrentSourceKind",
        "haSourceEffective",
    ] {
        assert!(
            body.get(local_setting).is_none(),
            "node detail must not include current-node field {local_setting}"
        );
    }

    let _ = std::fs::remove_file(db_path);
}
