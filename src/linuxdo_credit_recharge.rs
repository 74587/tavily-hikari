use chrono::{Datelike, Local, TimeZone, Utc};

pub const LINUXDO_CREDIT_RECHARGE_STATUS_PENDING: &str = "pending";
pub const LINUXDO_CREDIT_RECHARGE_STATUS_PAID: &str = "paid";
pub const LINUXDO_CREDIT_RECHARGE_STATUS_FAILED: &str = "failed";
pub const LINUXDO_CREDIT_RECHARGE_UNIT_CREDITS: i64 = 1000;
pub const LINUXDO_CREDIT_RECHARGE_UNIT_PRICE_CENTS: i64 = 10_000;
pub const LINUXDO_CREDIT_RECHARGE_MIN_MONTHS: i64 = 1;

#[derive(Debug, Clone)]
pub struct LinuxDoCreditRechargeOrder {
    pub out_trade_no: String,
    pub user_id: String,
    pub status: String,
    pub credits: i64,
    pub months: i64,
    pub money_cents: i64,
    pub trade_no: Option<String>,
    pub payment_url: Option<String>,
    pub order_name: String,
    pub notify_payload: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub paid_at: Option<i64>,
    pub last_notify_at: Option<i64>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LinuxDoCreditRechargeEntitlement {
    pub id: i64,
    pub out_trade_no: String,
    pub user_id: String,
    pub month_start: i64,
    pub credits: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Default)]
pub struct LinuxDoCreditRechargeSummary {
    pub current_month_start: i64,
    pub current_month_entitlement_credits: i64,
    pub effective_until_month_start: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct LinuxDoCreditRechargeAdminAudit {
    pub current_month_entitlement_credits: i64,
    pub effective_until_month_start: Option<i64>,
    pub orders: Vec<LinuxDoCreditRechargeOrder>,
    pub entitlements: Vec<LinuxDoCreditRechargeEntitlement>,
}

pub fn linuxdo_credit_recharge_money_cents(credits: i64, months: i64) -> Option<i64> {
    if credits <= 0
        || months < LINUXDO_CREDIT_RECHARGE_MIN_MONTHS
        || credits % LINUXDO_CREDIT_RECHARGE_UNIT_CREDITS != 0
    {
        return None;
    }
    let units = credits.checked_div(LINUXDO_CREDIT_RECHARGE_UNIT_CREDITS)?;
    units
        .checked_mul(months)?
        .checked_mul(LINUXDO_CREDIT_RECHARGE_UNIT_PRICE_CENTS)
}

pub fn format_linuxdo_credit_money(money_cents: i64) -> String {
    let cents = money_cents.max(0);
    format!("{}.{:02}", cents / 100, cents % 100)
}

pub(crate) fn shift_local_month_start_utc_ts(
    current_month_start_utc_ts: i64,
    delta_months: i32,
) -> i64 {
    let Some(current_utc) = Utc.timestamp_opt(current_month_start_utc_ts, 0).single() else {
        return current_month_start_utc_ts;
    };
    let current_local = current_utc.with_timezone(&Local);
    let zero_indexed = current_local.month0() as i32 + delta_months;
    let year = current_local.year() + zero_indexed.div_euclid(12);
    let month0 = zero_indexed.rem_euclid(12) as u32;
    let Some(date) = chrono::NaiveDate::from_ymd_opt(year, month0 + 1, 1) else {
        return current_month_start_utc_ts;
    };
    crate::local_date_start_utc_ts(date, current_local)
}
