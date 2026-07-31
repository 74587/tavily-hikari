use super::ProxyError;
use sqlx::Connection;
use sqlx::Sqlite;
use sqlx::SqliteConnection;
use std::ops::{Deref, DerefMut};

/// A raw `BEGIN IMMEDIATE` transaction that cannot return an open transaction
/// to the pool when its future is cancelled.
#[derive(Debug)]
pub(crate) struct ImmediateSqliteTransaction {
    conn: Option<sqlx::pool::PoolConnection<Sqlite>>,
}

impl ImmediateSqliteTransaction {
    pub(crate) async fn begin(
        conn: sqlx::pool::PoolConnection<Sqlite>,
    ) -> Result<Self, ProxyError> {
        let mut transaction = Self { conn: Some(conn) };
        if let Err(err) = sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *transaction)
            .await
        {
            let _ = sqlx::query("ROLLBACK").execute(&mut *transaction).await;
            let conn = transaction
                .conn
                .take()
                .expect("immediate transaction connection");
            conn.detach().close().await.ok();
            return Err(ProxyError::Database(err));
        }
        Ok(transaction)
    }

    pub(crate) async fn commit(self) -> Result<(), ProxyError> {
        self.commit_connection().await.map(drop)
    }

    pub(crate) async fn commit_connection(
        mut self,
    ) -> Result<sqlx::pool::PoolConnection<Sqlite>, ProxyError> {
        let commit_result = sqlx::query("COMMIT").execute(&mut *self).await;
        if let Err(err) = commit_result {
            let _ = sqlx::query("ROLLBACK").execute(&mut *self).await;
            let conn = self.conn.take().expect("immediate transaction connection");
            conn.detach().close().await.ok();
            return Err(ProxyError::Database(err));
        }
        Ok(self.conn.take().expect("immediate transaction connection"))
    }

    pub(crate) async fn rollback(mut self) -> Result<(), ProxyError> {
        let result = sqlx::query("ROLLBACK").execute(&mut *self).await;
        let conn = self.conn.take().expect("immediate transaction connection");
        conn.detach().close().await.ok();
        result.map(|_| ()).map_err(ProxyError::from)
    }
}

impl Deref for ImmediateSqliteTransaction {
    type Target = SqliteConnection;

    fn deref(&self) -> &Self::Target {
        self.conn
            .as_ref()
            .expect("immediate transaction connection")
            .as_ref()
    }
}

impl DerefMut for ImmediateSqliteTransaction {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.conn
            .as_mut()
            .expect("immediate transaction connection")
            .as_mut()
    }
}

impl Drop for ImmediateSqliteTransaction {
    fn drop(&mut self) {
        if let Some(conn) = self.conn.take() {
            // Detaching prevents PoolConnection::drop from returning a possibly
            // transaction-polluted physical connection to the shared pool.
            drop(conn.detach());
        }
    }
}
