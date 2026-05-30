import { Icon } from '../lib/icons'
import type { HaStatus } from '../api'

interface HaStatusBannerProps {
  status: HaStatus | null
  audience: 'admin' | 'user'
  onPromote?: () => void
  onFinalize?: () => void
  busy?: boolean
}

function roleLabel(role: HaStatus['role']): string {
  if (role === 'full_master') return 'Full master'
  if (role === 'provisional_master') return 'Provisional master'
  if (role === 'standby') return 'Standby'
  return 'Recovery'
}

export default function HaStatusBanner({
  status,
  audience,
  onPromote,
  onFinalize,
  busy = false,
}: HaStatusBannerProps): JSX.Element | null {
  if (!status || status.mode === 'single' || !status.degraded) return null

  const admin = audience === 'admin'
  const title = status.role === 'provisional_master'
    ? 'Failover is active but not finalized'
    : status.role === 'standby'
      ? 'This node is in standby'
      : 'This node is in recovery'
  const detail = status.role === 'provisional_master'
    ? 'API and MCP traffic can continue. Registration, recharge, and configuration writes stay disabled until an administrator finalizes failover.'
    : status.role === 'standby'
      ? 'This node is syncing and should not handle external writes. Promote only when the current EdgeOne origin is unhealthy.'
      : 'Only mergeable usage, log, event, and payment notification data should be imported from this node.'

  return (
    <section className="ha-status-banner" role="status" aria-live="polite">
      <div className="ha-status-banner-icon" aria-hidden="true">
        <Icon icon="mdi:alert-circle-outline" width={22} height={22} />
      </div>
      <div className="ha-status-banner-copy">
        <div className="ha-status-banner-title">{title}</div>
        <p>{detail}</p>
        {admin && (
          <dl className="ha-status-banner-meta">
            <div><dt>Node</dt><dd>{status.nodeId}</dd></div>
            <div><dt>Role</dt><dd>{roleLabel(status.role)}</dd></div>
            <div><dt>EdgeOne origin</dt><dd>{status.edgeoneOrigin ?? 'unknown'}</dd></div>
            <div><dt>Sync lag</dt><dd>{status.syncLagSeconds == null ? 'unknown' : `${status.syncLagSeconds}s`}</dd></div>
          </dl>
        )}
      </div>
      {admin && (
        <div className="ha-status-banner-actions">
          {status.role === 'standby' && onPromote && (
            <button type="button" onClick={onPromote} disabled={busy}>
              Promote
            </button>
          )}
          {status.role === 'provisional_master' && onFinalize && (
            <button type="button" onClick={onFinalize} disabled={busy}>
              Finalize
            </button>
          )}
        </div>
      )}
    </section>
  )
}
