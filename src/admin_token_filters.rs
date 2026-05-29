#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdminTokenOwnerFilter {
    All,
    Bound,
    Unbound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdminTokenEnabledFilter {
    All,
    Active,
    Frozen,
}

#[derive(Debug, Clone)]
pub struct AdminTokenListFilters {
    pub group: Option<String>,
    pub no_group: bool,
    pub search: Option<String>,
    pub owner: AdminTokenOwnerFilter,
    pub enabled: AdminTokenEnabledFilter,
    pub quota_state: Option<String>,
}

impl Default for AdminTokenListFilters {
    fn default() -> Self {
        Self {
            group: None,
            no_group: false,
            search: None,
            owner: AdminTokenOwnerFilter::All,
            enabled: AdminTokenEnabledFilter::All,
            quota_state: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct AdminTokenBatchMutationResult {
    pub updated: i64,
    pub missing: Vec<String>,
}
