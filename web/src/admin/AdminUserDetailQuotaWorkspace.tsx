import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import DateTimeRangeField from '../components/DateTimeRangeField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import type {
  AccountEntitlementScopeKind,
  AdminUserDetail,
  AdminUserEntitlement,
  AdminUserQuotaBreakdownEntry,
  CreateAdminUserEntitlementPayload,
} from '../api'
import type { AdminTranslations } from '../i18n'
import type { AdminRechargeTranslations } from '../i18n/adminRechargeTranslationTypes'
import { useEffect, useState } from 'react'
import { UserDetailQuotaBreakdown } from './UserDetailQuotaBreakdown'
import { UserRechargeQuotaCalendar } from './UserRechargeQuotaCalendar'

type EntitlementScopeFilter = AccountEntitlementScopeKind | 'all'

const ENTITLEMENT_DELTA_STAGES = [
  -100_000,
  -50_000,
  -20_000,
  -10_000,
  -5_000,
  -2_000,
  -1_000,
  -500,
  -250,
  -100,
  -50,
  -25,
  -10,
  -5,
  -1,
  0,
  1,
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1_000,
  2_000,
  5_000,
  10_000,
  20_000,
  50_000,
  100_000,
] as const

interface EntitlementFormState {
  scopeKind: AccountEntitlementScopeKind
  month: string
  businessCalls1hDelta: string
  dailyCreditsDelta: string
  monthlyCreditsDelta: string
  backendNote: string
  frontendNote: string
}

function buildQuotaBreakdownEntry(
  entry: Pick<
    AdminUserQuotaBreakdownEntry,
    'kind' | 'label' | 'tagId' | 'tagName' | 'source' | 'effectKind'
  > & {
    businessCalls1hDelta: number
    dailyCreditsDelta: number
    monthlyCreditsDelta: number
  },
): AdminUserQuotaBreakdownEntry {
  return {
    ...entry,
    businessCalls1hDelta: entry.businessCalls1hDelta,
    dailyCreditsDelta: entry.dailyCreditsDelta,
    monthlyCreditsDelta: entry.monthlyCreditsDelta,
  }
}

interface AdminUserDetailQuotaWorkspaceProps {
  detail: AdminUserDetail
  usersStrings: AdminTranslations['users']
  rechargeStrings: AdminRechargeTranslations['userDetail']
  language: 'en' | 'zh'
  hasBlockAllTag: boolean
  formatNumber: (value: number) => string
  formatQuotaLimitValue: (value: number) => string
  formatSignedQuotaDelta: (value: number) => string
  onCreateEntitlement: (userId: string, payload: CreateAdminUserEntitlementPayload) => Promise<AdminUserEntitlement>
  onFetchEntitlements: (
    userId: string,
    filters: { scopeKind?: EntitlementScopeFilter; startMonth?: number | null; endMonthBefore?: number | null },
  ) => Promise<AdminUserEntitlement[]>
  onRefreshDetail: () => Promise<void>
}

export function AdminUserDetailQuotaWorkspace({
  detail,
  usersStrings,
  rechargeStrings,
  language,
  hasBlockAllTag,
  formatNumber,
  formatQuotaLimitValue,
  formatSignedQuotaDelta,
  onCreateEntitlement,
  onFetchEntitlements,
  onRefreshDetail,
}: AdminUserDetailQuotaWorkspaceProps): JSX.Element {
  const defaultMonth = formatMonthInput(detail.entitlements.currentMonthStart || Math.floor(Date.now() / 1000))
  const [entitlementForm, setEntitlementForm] = useState<EntitlementFormState>(() => ({
    scopeKind: 'base',
    month: defaultMonth,
    businessCalls1hDelta: '0',
    dailyCreditsDelta: '0',
    monthlyCreditsDelta: '0',
    backendNote: '',
    frontendNote: '',
  }))
  const [entitlementScopeFilter, setEntitlementScopeFilter] = useState<EntitlementScopeFilter>('all')
  const [entitlementStartMonth, setEntitlementStartMonth] = useState('')
  const [entitlementEndMonth, setEntitlementEndMonth] = useState('')
  const [entitlementItems, setEntitlementItems] = useState<AdminUserEntitlement[]>(detail.entitlements.items)
  const [entitlementBusy, setEntitlementBusy] = useState(false)
  const [entitlementError, setEntitlementError] = useState<string | null>(null)
  const [entitlementDialogOpen, setEntitlementDialogOpen] = useState(false)
  useEffect(() => {
    setEntitlementItems(detail.entitlements.items)
    setEntitlementForm((current) => ({ ...current, month: current.month || defaultMonth }))
  }, [defaultMonth, detail.entitlements.items])
  const breakdownEntries = detail.quotaBreakdown.length > 0
    ? detail.quotaBreakdown
    : buildFallbackQuotaBreakdown(detail, rechargeStrings.rechargeColumn)
  const submitEntitlement = async () => {
    setEntitlementBusy(true)
    setEntitlementError(null)
    try {
      const payload: CreateAdminUserEntitlementPayload = {
        scopeKind: entitlementForm.scopeKind,
        monthStart: entitlementForm.scopeKind === 'month' ? parseMonthInput(entitlementForm.month) : null,
        businessCalls1hDelta: parseIntegerInput(entitlementForm.businessCalls1hDelta),
        dailyCreditsDelta: parseIntegerInput(entitlementForm.dailyCreditsDelta),
        monthlyCreditsDelta: parseIntegerInput(entitlementForm.monthlyCreditsDelta),
        backendNote: entitlementForm.backendNote.trim(),
        frontendNote: entitlementForm.frontendNote.trim(),
      }
      if (payload.scopeKind === 'month' && !payload.monthStart) throw new Error(rechargeStrings.entitlementInvalidMonth)
      if (!payload.frontendNote) throw new Error(rechargeStrings.entitlementNotesRequired)
      if (!payload.businessCalls1hDelta && !payload.dailyCreditsDelta && !payload.monthlyCreditsDelta) {
        throw new Error(rechargeStrings.entitlementDeltaRequired)
      }
      await onCreateEntitlement(detail.userId, payload)
      setEntitlementForm((current) => ({
        ...current,
        businessCalls1hDelta: '0',
        dailyCreditsDelta: '0',
        monthlyCreditsDelta: '0',
        backendNote: '',
        frontendNote: '',
      }))
      await onRefreshDetail()
      setEntitlementDialogOpen(false)
    } catch (err) {
      setEntitlementError(err instanceof Error ? err.message : rechargeStrings.entitlementCreateFailed)
    } finally {
      setEntitlementBusy(false)
    }
  }
  const applyEntitlementFilters = async () => {
    setEntitlementBusy(true)
    setEntitlementError(null)
    try {
      const items = await onFetchEntitlements(detail.userId, {
        scopeKind: entitlementScopeFilter,
        startMonth: entitlementStartMonth ? parseMonthInput(entitlementStartMonth) : null,
        endMonthBefore: entitlementEndMonth ? addLocalMonths(parseMonthInput(entitlementEndMonth), 1) : null,
      })
      setEntitlementItems(items)
    } catch (err) {
      setEntitlementError(err instanceof Error ? err.message : rechargeStrings.entitlementLoadFailed)
    } finally {
      setEntitlementBusy(false)
    }
  }

  return (
    <section className="surface panel user-detail-quota-workspace" id="user-detail-quota">
      <div className="panel-header" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>{usersStrings.quota.title}</h2>
          <p className="panel-description">{usersStrings.quota.description}</p>
        </div>
      </div>

      {hasBlockAllTag && (
        <div className="alert alert-warning" role="status">
          {usersStrings.effectiveQuota.blockAllNotice}
        </div>
      )}

      <div className="user-detail-quota-breakdown">
        <div className="user-detail-subsection-heading">
          <h3>{usersStrings.effectiveQuota.title}</h3>
          <p className="panel-description">{usersStrings.effectiveQuota.description}</p>
        </div>
        <UserDetailQuotaBreakdown
          entries={breakdownEntries}
          usersStrings={usersStrings}
          language={language}
          formatQuotaLimitValue={formatQuotaLimitValue}
          formatSignedQuotaDelta={formatSignedQuotaDelta}
        />
      </div>

      <UserRechargeQuotaCalendar
        detail={detail}
        strings={rechargeStrings}
        language={language}
        formatNumber={formatNumber}
        embedded
      />

      <div className="user-detail-entitlements">
        <div className="user-detail-entitlement-heading-row">
          <div className="user-detail-subsection-heading">
            <h3>{rechargeStrings.entitlementTitle}</h3>
            <p className="panel-description">{rechargeStrings.entitlementDescription}</p>
          </div>
          <Dialog
            open={entitlementDialogOpen}
            onOpenChange={(open) => {
              if (entitlementBusy) return
              setEntitlementDialogOpen(open)
              if (open) setEntitlementError(null)
            }}
          >
            <DialogTrigger asChild>
              <Button type="button">{rechargeStrings.entitlementCreate}</Button>
            </DialogTrigger>
            <DialogContent className="user-detail-entitlement-dialog sm:max-w-[64rem]">
              <DialogHeader>
                <DialogTitle>{rechargeStrings.entitlementCreate}</DialogTitle>
                <DialogDescription>{rechargeStrings.entitlementDescription}</DialogDescription>
              </DialogHeader>
              <div className="user-detail-entitlement-form user-detail-entitlement-form--dialog">
                <label>
                  <span>{rechargeStrings.entitlementScope}</span>
                  <select
                    value={entitlementForm.scopeKind}
                    onChange={(event) => {
                      const value = event.target.value
                      setEntitlementForm((current) => ({
                        ...current,
                        scopeKind: value === 'permanent' ? 'permanent' : value === 'month' ? 'month' : 'base',
                      }))
                    }}
                    disabled={entitlementBusy}
                  >
                    <option value="base">{rechargeStrings.entitlementScopeBase}</option>
                    <option value="month">{rechargeStrings.entitlementScopeMonth}</option>
                    <option value="permanent">{rechargeStrings.entitlementScopePermanent}</option>
                  </select>
                </label>
                <label>
                  <span>{rechargeStrings.entitlementMonth}</span>
                  <input
                    className="input input-bordered"
                    type="month"
                    value={entitlementForm.month}
                    onChange={(event) => setEntitlementForm((current) => ({ ...current, month: event.target.value }))}
                    disabled={entitlementBusy || entitlementForm.scopeKind !== 'month'}
                  />
                </label>
                <EntitlementDeltaField
                  name="businessCalls1hDelta"
                  label={usersStrings.quota.hourly}
                  value={entitlementForm.businessCalls1hDelta}
                  disabled={entitlementBusy}
                  onChange={(value) => setEntitlementForm((current) => ({ ...current, businessCalls1hDelta: value }))}
                />
                <EntitlementDeltaField
                  name="dailyCreditsDelta"
                  label={usersStrings.quota.daily}
                  value={entitlementForm.dailyCreditsDelta}
                  disabled={entitlementBusy}
                  onChange={(value) => setEntitlementForm((current) => ({ ...current, dailyCreditsDelta: value }))}
                />
                <EntitlementDeltaField
                  name="monthlyCreditsDelta"
                  label={usersStrings.quota.monthly}
                  value={entitlementForm.monthlyCreditsDelta}
                  disabled={entitlementBusy}
                  onChange={(value) => setEntitlementForm((current) => ({ ...current, monthlyCreditsDelta: value }))}
                />
                <label className="user-detail-entitlement-note">
                  <span>{rechargeStrings.entitlementBackendNote}</span>
                  <textarea value={entitlementForm.backendNote} onChange={(event) => setEntitlementForm((current) => ({ ...current, backendNote: event.target.value }))} disabled={entitlementBusy} />
                </label>
                <label className="user-detail-entitlement-note">
                  <span>{rechargeStrings.entitlementFrontendNote}</span>
                  <textarea value={entitlementForm.frontendNote} onChange={(event) => setEntitlementForm((current) => ({ ...current, frontendNote: event.target.value }))} disabled={entitlementBusy} />
                </label>
                <div className="user-detail-entitlement-dialog-actions">
                  <Button type="button" onClick={() => void submitEntitlement()} disabled={entitlementBusy}>
                    {entitlementBusy ? rechargeStrings.entitlementSaving : rechargeStrings.entitlementCreate}
                  </Button>
                </div>
              </div>
              {entitlementError && <p className="admin-recharge-dialog-error" role="status">{entitlementError}</p>}
            </DialogContent>
          </Dialog>
        </div>
        <div className="user-detail-entitlement-summary">
          <span>{rechargeStrings.entitlementBase.replace('{value}', formatSignedQuotaDelta(detail.entitlements.currentBaseDelta.monthlyCreditsDelta))}</span>
          <span>{rechargeStrings.entitlementCurrentMonth.replace('{value}', formatSignedQuotaDelta(detail.entitlements.currentMonthDelta.monthlyCreditsDelta))}</span>
          <span>{rechargeStrings.entitlementPermanent.replace('{value}', formatSignedQuotaDelta(detail.entitlements.currentPermanentDelta.monthlyCreditsDelta))}</span>
        </div>
        <div className="user-detail-entitlement-filters">
          <Select value={entitlementScopeFilter} onValueChange={(value) => setEntitlementScopeFilter(value as EntitlementScopeFilter)} disabled={entitlementBusy}>
            <SelectTrigger className="user-detail-entitlement-scope-select" aria-label={rechargeStrings.entitlementScope}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">{rechargeStrings.entitlementScopeAll}</SelectItem>
              <SelectItem value="base">{rechargeStrings.entitlementScopeBase}</SelectItem>
              <SelectItem value="month">{rechargeStrings.entitlementScopeMonth}</SelectItem>
              <SelectItem value="permanent">{rechargeStrings.entitlementScopePermanent}</SelectItem>
            </SelectContent>
          </Select>
          <DateTimeRangeField
            className="user-detail-entitlement-month-range"
            label={rechargeStrings.entitlementFilterRange}
            hideLabel
            inputType="month"
            startId="user-detail-entitlement-filter-start"
            endId="user-detail-entitlement-filter-end"
            startLabel={rechargeStrings.entitlementFilterStart}
            endLabel={rechargeStrings.entitlementFilterEnd}
            startValue={entitlementStartMonth}
            endValue={entitlementEndMonth}
            startSeparator={rechargeStrings.entitlementFilterSeparator}
            startMax={entitlementEndMonth || undefined}
            endMin={entitlementStartMonth || undefined}
            disabled={entitlementBusy}
            onStartChange={setEntitlementStartMonth}
            onEndChange={setEntitlementEndMonth}
          />
          <Button className="user-detail-entitlement-apply-button" type="button" variant="outline" onClick={() => void applyEntitlementFilters()} disabled={entitlementBusy}>
            {rechargeStrings.entitlementApplyFilters}
          </Button>
        </div>
        <EntitlementTable
          items={entitlementItems}
          strings={rechargeStrings}
          locale={language === 'zh' ? 'zh-CN' : 'en-US'}
          formatSignedQuotaDelta={formatSignedQuotaDelta}
        />
      </div>
    </section>
  )
}

function EntitlementDeltaField({
  name,
  label,
  value,
  disabled,
  onChange,
}: {
  name: string
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const parsedValue = parseSignedDeltaInput(value)
  const inputId = `${name}-entitlement-delta`
  return (
    <div className="user-detail-entitlement-delta-control">
      <div className="user-detail-entitlement-delta-head">
        <label htmlFor={inputId}>{label}</label>
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="user-detail-entitlement-delta-input"
          value={formatSignedDeltaInput(value)}
          onChange={(event) => {
            const normalized = normalizeSignedDeltaInput(event.target.value)
            if (normalized == null) return
            onChange(normalized)
          }}
          aria-label={`${label} delta input`}
          disabled={disabled}
        />
      </div>
      <input
        type="range"
        name={`${name}-entitlement-delta-slider`}
        min={0}
        max={ENTITLEMENT_DELTA_STAGES.length - 1}
        step="any"
        className="range quota-slider user-detail-entitlement-delta-slider"
        value={getSignedDeltaSliderPosition(parsedValue)}
        onChange={(event) => {
          const nextIndex = clampSignedDeltaSliderIndex(Number.parseFloat(event.target.value))
          onChange(String(ENTITLEMENT_DELTA_STAGES[nextIndex] ?? 0))
        }}
        style={{ background: buildSignedDeltaSliderTrack(parsedValue) }}
        aria-label={label}
        aria-valuetext={String(parsedValue)}
        disabled={disabled}
      />
    </div>
  )
}

function EntitlementTable({
  items,
  strings,
  locale,
  formatSignedQuotaDelta,
}: {
  items: AdminUserEntitlement[]
  strings: AdminRechargeTranslations['userDetail']
  locale: string
  formatSignedQuotaDelta: (value: number) => string
}) {
  if (items.length === 0) return <div className="empty-state alert">{strings.entitlementEmpty}</div>
  return (
    <div className="table-scroll-shell admin-recharge-quota-table-scroll" data-table-density="compact">
      <table className="admin-recharge-quota-table user-detail-entitlement-table" data-table-density="compact">
        <thead>
          <tr>
            <th>{strings.entitlementScope}</th>
            <th>{strings.monthColumn}</th>
            <th>{strings.entitlementDeltaColumns}</th>
            <th>{strings.entitlementSource}</th>
            <th>{strings.entitlementNotes}</th>
            <th>{strings.entitlementActor}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatEntitlementScope(item.scopeKind, strings)}</td>
              <td>{item.scopeKind === 'month' ? formatMonth(item.monthStart, locale) : '—'}</td>
              <td>
                <div className="token-compact-pair">
                  <span>{formatSignedQuotaDelta(item.businessCalls1hDelta)}</span>
                  <span>{formatSignedQuotaDelta(item.dailyCreditsDelta)}</span>
                  <span>{formatSignedQuotaDelta(item.monthlyCreditsDelta)}</span>
                </div>
              </td>
              <td>{item.sourceKind}</td>
              <td>
                <div className="token-compact-pair">
                  <span>{item.backendNote}</span>
                  <span>{item.frontendNote}</span>
                </div>
              </td>
              <td>{item.actorDisplayName || item.actorUserId || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatMonthInput(ts: number): string {
  const date = new Date(ts * 1000)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function parseMonthInput(value: string): number {
  const [year, month] = value.split('-').map((item) => Number(item))
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0
  return Math.floor(new Date(year, month - 1, 1).getTime() / 1000)
}

function addLocalMonths(ts: number, months: number): number {
  if (!ts) return 0
  const date = new Date(ts * 1000)
  date.setMonth(date.getMonth() + months)
  return Math.floor(date.getTime() / 1000)
}

function formatMonth(ts: number, locale: string): string {
  return new Date(ts * 1000).toLocaleDateString(locale, { year: 'numeric', month: 'short' })
}

function formatEntitlementScope(
  scopeKind: AccountEntitlementScopeKind,
  strings: AdminRechargeTranslations['userDetail'],
): string {
  if (scopeKind === 'base') return strings.entitlementScopeBase
  if (scopeKind === 'permanent') return strings.entitlementScopePermanent
  return strings.entitlementScopeMonth
}

function parseIntegerInput(value: string): number {
  const parsed = Number.parseInt(normalizeSignedDeltaInput(value) ?? '', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeSignedDeltaInput(value: string | undefined): string | null {
  const trimmed = (value ?? '').replace(/[\s,_']/g, '').trim()
  if (!trimmed) return ''
  if (trimmed === '-' || trimmed === '+') return trimmed
  if (!/^[+-]?\d+$/.test(trimmed)) return null

  const sign = trimmed.startsWith('-') ? '-' : trimmed.startsWith('+') ? '+' : ''
  const digitsOnly = trimmed.replace(/^[+-]/, '').replace(/^0+(?=\d)/, '')
  if (!digitsOnly || Number.parseInt(digitsOnly, 10) === 0) return '0'
  return `${sign}${digitsOnly}`
}

function parseSignedDeltaInput(value: string | undefined): number {
  const normalized = normalizeSignedDeltaInput(value)
  const parsed = Number.parseInt(normalized ?? '', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatSignedDeltaInput(value: string | undefined): string {
  const normalized = normalizeSignedDeltaInput(value)
  if (normalized == null) return value ?? ''
  if (!normalized || normalized === '-' || normalized === '+') return normalized

  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed)) return normalized
  const sign = parsed < 0 ? '-' : normalized.startsWith('+') && parsed > 0 ? '+' : ''
  return `${sign}${Math.abs(parsed).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function getSignedDeltaSliderPosition(value: number): number {
  if (value <= ENTITLEMENT_DELTA_STAGES[0]) return 0
  for (let index = 0; index < ENTITLEMENT_DELTA_STAGES.length - 1; index += 1) {
    const left = ENTITLEMENT_DELTA_STAGES[index] ?? 0
    const right = ENTITLEMENT_DELTA_STAGES[index + 1] ?? left
    if (value <= right) {
      if (right <= left) return index + 1
      return index + (value - left) / (right - left)
    }
  }
  return ENTITLEMENT_DELTA_STAGES.length - 1
}

function clampSignedDeltaSliderIndex(index: number): number {
  if (!Number.isFinite(index)) return ENTITLEMENT_DELTA_STAGES.indexOf(0)
  return Math.min(ENTITLEMENT_DELTA_STAGES.length - 1, Math.max(0, Math.round(index)))
}

function toSignedDeltaSliderPercent(value: number): number {
  return Math.min(100, Math.max(0, (getSignedDeltaSliderPosition(value) / (ENTITLEMENT_DELTA_STAGES.length - 1)) * 100))
}

function buildSignedDeltaSliderTrack(value: number): string {
  const zero = toSignedDeltaSliderPercent(0)
  const current = toSignedDeltaSliderPercent(value)
  const start = Math.min(zero, current)
  const end = Math.max(zero, current)
  const activeColor = value < 0 ? 'hsl(var(--destructive) / 0.46)' : 'hsl(var(--primary) / 0.5)'
  return `linear-gradient(to right, hsl(var(--muted) / 0.5) 0% ${start}%, ${activeColor} ${start}% ${end}%, hsl(var(--muted) / 0.5) ${end}% 100%)`
}

function buildFallbackQuotaBreakdown(
  detail: AdminUserDetail,
  rechargeLabel: string,
): AdminUserQuotaBreakdownEntry[] {
  const rows: AdminUserQuotaBreakdownEntry[] = [
    buildQuotaBreakdownEntry({
      kind: 'base',
      label: 'base',
      tagId: null,
      tagName: null,
      source: null,
      effectKind: 'base',
      businessCalls1hDelta: detail.quotaBase.businessCalls1hLimit,
      dailyCreditsDelta: detail.quotaBase.dailyCreditsLimit,
      monthlyCreditsDelta: detail.quotaBase.monthlyCreditsLimit,
    }),
  ]
  const rechargeMonthlyDelta = detail.recharge?.currentMonthEntitlementMonthlyDelta ?? 0
  if (rechargeMonthlyDelta > 0) {
    rows.push(buildQuotaBreakdownEntry({
      kind: 'recharge',
      label: rechargeLabel,
      tagId: null,
      tagName: null,
      source: 'system_linuxdo',
      effectKind: 'quota_delta',
      businessCalls1hDelta: detail.recharge?.currentMonthEntitlementHourlyDelta ?? 0,
      dailyCreditsDelta: detail.recharge?.currentMonthEntitlementDailyDelta ?? 0,
      monthlyCreditsDelta: rechargeMonthlyDelta,
    }))
  }
  rows.push(buildQuotaBreakdownEntry({
    kind: 'effective',
    label: 'effective',
    tagId: null,
    tagName: null,
    source: null,
    effectKind: 'effective',
    businessCalls1hDelta: detail.effectiveQuota.businessCalls1hLimit,
    dailyCreditsDelta: detail.effectiveQuota.dailyCreditsLimit,
    monthlyCreditsDelta: detail.effectiveQuota.monthlyCreditsLimit,
  }))
  return rows
}
