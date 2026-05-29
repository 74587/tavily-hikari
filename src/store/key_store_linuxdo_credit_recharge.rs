impl KeyStore {
    pub(crate) async fn ensure_linuxdo_credit_recharge_schema(&self) -> Result<(), ProxyError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS linuxdo_credit_recharge_orders (
                out_trade_no TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                status TEXT NOT NULL,
                credits INTEGER NOT NULL,
                months INTEGER NOT NULL,
                money_cents INTEGER NOT NULL,
                trade_no TEXT,
                payment_url TEXT,
                order_name TEXT NOT NULL,
                notify_payload TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                paid_at INTEGER,
                last_notify_at INTEGER,
                last_error TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            r#"CREATE INDEX IF NOT EXISTS idx_linuxdo_credit_recharge_orders_user_time
               ON linuxdo_credit_recharge_orders(user_id, created_at DESC)"#,
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS linuxdo_credit_recharge_entitlements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                out_trade_no TEXT NOT NULL,
                user_id TEXT NOT NULL,
                month_start INTEGER NOT NULL,
                credits INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(out_trade_no, month_start),
                FOREIGN KEY (out_trade_no) REFERENCES linuxdo_credit_recharge_orders(out_trade_no),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        sqlx::query(
            r#"CREATE INDEX IF NOT EXISTS idx_linuxdo_credit_recharge_entitlements_user_month
               ON linuxdo_credit_recharge_entitlements(user_id, month_start)"#,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    fn linuxdo_credit_recharge_order_from_row(
        row: &sqlx::sqlite::SqliteRow,
    ) -> Result<LinuxDoCreditRechargeOrder, ProxyError> {
        Ok(LinuxDoCreditRechargeOrder {
            out_trade_no: row.try_get("out_trade_no")?,
            user_id: row.try_get("user_id")?,
            status: row.try_get("status")?,
            credits: row.try_get("credits")?,
            months: row.try_get("months")?,
            money_cents: row.try_get("money_cents")?,
            trade_no: row.try_get("trade_no")?,
            payment_url: row.try_get("payment_url")?,
            order_name: row.try_get("order_name")?,
            notify_payload: row.try_get("notify_payload")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            paid_at: row.try_get("paid_at")?,
            last_notify_at: row.try_get("last_notify_at")?,
            last_error: row.try_get("last_error")?,
        })
    }

    fn linuxdo_credit_recharge_entitlement_from_row(
        row: &sqlx::sqlite::SqliteRow,
    ) -> Result<LinuxDoCreditRechargeEntitlement, ProxyError> {
        Ok(LinuxDoCreditRechargeEntitlement {
            id: row.try_get("id")?,
            out_trade_no: row.try_get("out_trade_no")?,
            user_id: row.try_get("user_id")?,
            month_start: row.try_get("month_start")?,
            credits: row.try_get("credits")?,
            created_at: row.try_get("created_at")?,
        })
    }

    pub(crate) async fn create_linuxdo_credit_recharge_order(
        &self,
        order: &LinuxDoCreditRechargeOrder,
    ) -> Result<(), ProxyError> {
        sqlx::query(
            r#"
            INSERT INTO linuxdo_credit_recharge_orders (
                out_trade_no, user_id, status, credits, months, money_cents,
                trade_no, payment_url, order_name, notify_payload, created_at, updated_at,
                paid_at, last_notify_at, last_error
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&order.out_trade_no)
        .bind(&order.user_id)
        .bind(&order.status)
        .bind(order.credits)
        .bind(order.months)
        .bind(order.money_cents)
        .bind(&order.trade_no)
        .bind(&order.payment_url)
        .bind(&order.order_name)
        .bind(&order.notify_payload)
        .bind(order.created_at)
        .bind(order.updated_at)
        .bind(order.paid_at)
        .bind(order.last_notify_at)
        .bind(&order.last_error)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub(crate) async fn update_linuxdo_credit_recharge_order_payment_url(
        &self,
        out_trade_no: &str,
        payment_url: &str,
        updated_at: i64,
    ) -> Result<(), ProxyError> {
        sqlx::query(
            r#"
            UPDATE linuxdo_credit_recharge_orders
               SET payment_url = ?, updated_at = ?
             WHERE out_trade_no = ?
            "#,
        )
        .bind(payment_url)
        .bind(updated_at)
        .bind(out_trade_no)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub(crate) async fn mark_linuxdo_credit_recharge_order_failed(
        &self,
        out_trade_no: &str,
        message: &str,
        updated_at: i64,
    ) -> Result<(), ProxyError> {
        sqlx::query(
            r#"
            UPDATE linuxdo_credit_recharge_orders
               SET status = ?, last_error = ?, updated_at = ?
             WHERE out_trade_no = ? AND status = ?
            "#,
        )
        .bind(LINUXDO_CREDIT_RECHARGE_STATUS_FAILED)
        .bind(message)
        .bind(updated_at)
        .bind(out_trade_no)
        .bind(LINUXDO_CREDIT_RECHARGE_STATUS_PENDING)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub(crate) async fn fetch_linuxdo_credit_recharge_order(
        &self,
        out_trade_no: &str,
    ) -> Result<Option<LinuxDoCreditRechargeOrder>, ProxyError> {
        let row = sqlx::query(
            r#"
            SELECT *
            FROM linuxdo_credit_recharge_orders
            WHERE out_trade_no = ?
            LIMIT 1
            "#,
        )
        .bind(out_trade_no)
        .fetch_optional(&self.pool)
        .await?;
        row.as_ref()
            .map(Self::linuxdo_credit_recharge_order_from_row)
            .transpose()
    }

    pub(crate) async fn list_linuxdo_credit_recharge_orders_for_user(
        &self,
        user_id: &str,
        limit: i64,
    ) -> Result<Vec<LinuxDoCreditRechargeOrder>, ProxyError> {
        let rows = sqlx::query(
            r#"
            SELECT *
            FROM linuxdo_credit_recharge_orders
            WHERE user_id = ?
            ORDER BY created_at DESC, out_trade_no DESC
            LIMIT ?
            "#,
        )
        .bind(user_id)
        .bind(limit.clamp(1, 100))
        .fetch_all(&self.pool)
        .await?;
        rows.iter()
            .map(Self::linuxdo_credit_recharge_order_from_row)
            .collect()
    }

    pub(crate) async fn apply_linuxdo_credit_recharge_payment(
        &self,
        out_trade_no: &str,
        trade_no: &str,
        notify_payload: &str,
        paid_at: i64,
    ) -> Result<LinuxDoCreditRechargeOrder, ProxyError> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query(
            r#"
            SELECT *
            FROM linuxdo_credit_recharge_orders
            WHERE out_trade_no = ?
            LIMIT 1
            "#,
        )
        .bind(out_trade_no)
        .fetch_optional(&mut *tx)
        .await?;
        let Some(row) = row else {
            tx.rollback().await.ok();
            return Err(ProxyError::Other("recharge order not found".to_string()));
        };
        let order = Self::linuxdo_credit_recharge_order_from_row(&row)?;
        sqlx::query(
            r#"
            UPDATE linuxdo_credit_recharge_orders
               SET status = ?,
                   trade_no = COALESCE(NULLIF(?, ''), trade_no),
                   notify_payload = ?,
                   paid_at = COALESCE(paid_at, ?),
                   last_notify_at = ?,
                   updated_at = ?,
                   last_error = NULL
             WHERE out_trade_no = ?
            "#,
        )
        .bind(LINUXDO_CREDIT_RECHARGE_STATUS_PAID)
        .bind(trade_no)
        .bind(notify_payload)
        .bind(paid_at)
        .bind(paid_at)
        .bind(paid_at)
        .bind(out_trade_no)
        .execute(&mut *tx)
        .await?;

        let start_month = start_of_local_month_utc_ts(
            Utc.timestamp_opt(paid_at, 0)
                .single()
                .unwrap_or_else(Utc::now)
                .with_timezone(&Local),
        );
        for month_index in 0..order.months {
            let month_start = shift_local_month_start_utc_ts(start_month, month_index as i32);
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO linuxdo_credit_recharge_entitlements (
                    out_trade_no, user_id, month_start, credits, created_at
                )
                VALUES (?, ?, ?, ?, ?)
                "#,
            )
            .bind(out_trade_no)
            .bind(&order.user_id)
            .bind(month_start)
            .bind(order.credits)
            .bind(paid_at)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        self.invalidate_account_quota_resolution(&order.user_id).await;
        self.record_effective_account_quota_snapshot_at(&order.user_id, paid_at)
            .await?;
        self.fetch_linuxdo_credit_recharge_order(out_trade_no)
            .await?
            .ok_or_else(|| ProxyError::Other("recharge order disappeared".to_string()))
    }

    pub(crate) async fn sum_linuxdo_credit_recharge_entitlements_for_month(
        &self,
        user_id: &str,
        month_start: i64,
    ) -> Result<i64, ProxyError> {
        sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(SUM(credits), 0)
            FROM linuxdo_credit_recharge_entitlements
            WHERE user_id = ? AND month_start = ?
            "#,
        )
        .bind(user_id)
        .bind(month_start)
        .fetch_one(&self.pool)
        .await
        .map_err(ProxyError::Database)
    }

    pub(crate) async fn sum_current_linuxdo_credit_recharge_entitlements_for_month(
        &self,
        user_id: &str,
    ) -> Result<i64, ProxyError> {
        self.sum_linuxdo_credit_recharge_entitlements_for_month(
            user_id,
            start_of_local_month_utc_ts(Local::now()),
        )
        .await
    }

    pub(crate) async fn sum_linuxdo_credit_recharge_entitlements_for_users(
        &self,
        user_ids: &[String],
        month_start: i64,
    ) -> Result<HashMap<String, i64>, ProxyError> {
        if user_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let mut builder = QueryBuilder::new(
            "SELECT user_id, COALESCE(SUM(credits), 0) FROM linuxdo_credit_recharge_entitlements WHERE month_start = ",
        );
        builder.push_bind(month_start);
        builder.push(" AND user_id IN (");
        {
            let mut separated = builder.separated(", ");
            for user_id in user_ids {
                separated.push_bind(user_id);
            }
        }
        builder.push(") GROUP BY user_id");
        let rows = builder
            .build_query_as::<(String, i64)>()
            .fetch_all(&self.pool)
            .await?;
        Ok(rows.into_iter().collect())
    }

    pub(crate) async fn sum_current_linuxdo_credit_recharge_entitlements_for_users(
        &self,
        user_ids: &[String],
    ) -> Result<HashMap<String, i64>, ProxyError> {
        self.sum_linuxdo_credit_recharge_entitlements_for_users(
            user_ids,
            start_of_local_month_utc_ts(Local::now()),
        )
        .await
    }

    pub(crate) async fn linuxdo_credit_recharge_summary_for_user(
        &self,
        user_id: &str,
        current_month_start: i64,
    ) -> Result<LinuxDoCreditRechargeSummary, ProxyError> {
        let current_month_entitlement_credits = self
            .sum_linuxdo_credit_recharge_entitlements_for_month(user_id, current_month_start)
            .await?;
        let effective_until_month_start = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT MAX(month_start)
            FROM linuxdo_credit_recharge_entitlements
            WHERE user_id = ?
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(LinuxDoCreditRechargeSummary {
            current_month_start,
            current_month_entitlement_credits,
            effective_until_month_start,
        })
    }

    pub(crate) async fn list_linuxdo_credit_recharge_entitlements_for_user(
        &self,
        user_id: &str,
        limit: i64,
    ) -> Result<Vec<LinuxDoCreditRechargeEntitlement>, ProxyError> {
        let rows = sqlx::query(
            r#"
            SELECT *
            FROM linuxdo_credit_recharge_entitlements
            WHERE user_id = ?
            ORDER BY month_start DESC, id DESC
            LIMIT ?
            "#,
        )
        .bind(user_id)
        .bind(limit.clamp(1, 100))
        .fetch_all(&self.pool)
        .await?;
        rows.iter()
            .map(Self::linuxdo_credit_recharge_entitlement_from_row)
            .collect()
    }

    pub(crate) async fn linuxdo_credit_recharge_admin_audit(
        &self,
        user_id: &str,
        current_month_start: i64,
    ) -> Result<LinuxDoCreditRechargeAdminAudit, ProxyError> {
        let summary = self
            .linuxdo_credit_recharge_summary_for_user(user_id, current_month_start)
            .await?;
        Ok(LinuxDoCreditRechargeAdminAudit {
            current_month_entitlement_credits: summary.current_month_entitlement_credits,
            effective_until_month_start: summary.effective_until_month_start,
            orders: self
                .list_linuxdo_credit_recharge_orders_for_user(user_id, 10)
                .await?,
            entitlements: self
                .list_linuxdo_credit_recharge_entitlements_for_user(user_id, 24)
                .await?,
        })
    }
}
