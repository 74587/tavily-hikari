import { ArrowRight, CircleAlert, Crown, RotateCcw, Server, ShieldCheck } from 'lucide-react'

import type { HaStatus } from '../api'
import { Button } from './ui/button'
import { StatusBadge, type StatusTone } from './StatusBadge'

interface HaStatusBannerProps {
  status: HaStatus | null
  audience: 'admin' | 'user'
  adminVariant?: 'panel' | 'compact'
  onPromote?: () => void
  onFinalize?: () => void
  busy?: boolean
  compactHref?: string
  compactTitle?: string
  compactDescription?: string
  compactActionLabel?: string
  onCompactClick?: () => void
}

function roleLabel(role: HaStatus['role']): string {
  if (role === 'full_master') return 'Full master'
  if (role === 'provisional_master') return 'Provisional master'
  if (role === 'standby') return 'Standby'
  return 'Recovery'
}

function formatTimestamp(value: number | null): string {
  if (value == null) return 'Unknown'
  return new Date(value * 1000).toLocaleString()
}

function formatLag(value: number | null): string {
  if (value == null) return 'Unknown'
  if (value < 60) return `${value}s`
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

interface HaNodeRow {
  key: string
  nodeId: string
  relation: string
  role: string
  origin: string
  health: string
  healthTone: StatusTone
  lastSync: string
  promotedAt: string
  actionKind: 'promote' | 'finalize' | 'serving' | 'blocked' | 'remote'
}

function localHealth(status: HaStatus): Pick<HaNodeRow, 'health' | 'healthTone'> {
  if (status.role === 'full_master') return { health: 'Serving writes', healthTone: 'success' }
  if (status.role === 'provisional_master') return { health: 'Finalize required', healthTone: 'warning' }
  if (status.role === 'standby') return { health: 'Ready standby', healthTone: 'info' }
  return { health: 'Recovery required', healthTone: 'error' }
}

function localActionKind(status: HaStatus): HaNodeRow['actionKind'] {
  if (status.role === 'standby') return 'promote'
  if (status.role === 'provisional_master') return 'finalize'
  if (status.role === 'full_master') return 'serving'
  return 'blocked'
}

function remoteRole(status: HaStatus, origin: string): string {
  if (status.edgeoneOrigin === origin) return 'Active master'
  if (status.edgeoneExpectedOrigin === origin) return 'Expected master'
  return 'Peer'
}

function remoteHealth(status: HaStatus, origin: string): Pick<HaNodeRow, 'health' | 'healthTone'> {
  if (status.edgeoneOrigin === origin) return { health: 'Serving EdgeOne', healthTone: 'success' }
  if (status.edgeoneExpectedOrigin === origin) return { health: 'Not routed', healthTone: 'warning' }
  return { health: 'Configured', healthTone: 'neutral' }
}

function buildNodeRows(status: HaStatus): HaNodeRow[] {
  const localOrigin = status.nodePublicOrigin ?? 'Unknown'
  const local = localHealth(status)
  const rows: HaNodeRow[] = [
    {
      key: 'local',
      nodeId: status.nodeId,
      relation: 'This admin node',
      role: roleLabel(status.role),
      origin: localOrigin,
      health: local.health,
      healthTone: local.healthTone,
      lastSync: formatTimestamp(status.lastSyncAt),
      promotedAt:
        status.role === 'full_master' || status.role === 'provisional_master'
          ? formatTimestamp(status.lastEdgeoneCheckAt)
          : 'N/A',
      actionKind: localActionKind(status),
    },
  ]

  const remoteOrigins = [status.edgeoneOrigin, status.edgeoneExpectedOrigin]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin && origin !== status.nodePublicOrigin))

  for (const origin of Array.from(new Set(remoteOrigins))) {
    const health = remoteHealth(status, origin)
    rows.push({
      key: `remote-${origin}`,
      nodeId: origin === status.edgeoneExpectedOrigin ? 'configured-peer' : 'edgeone-origin',
      relation: origin === status.edgeoneExpectedOrigin ? 'Configured peer' : 'EdgeOne target',
      role: remoteRole(status, origin),
      origin,
      health: health.health,
      healthTone: health.healthTone,
      lastSync: origin === status.edgeoneExpectedOrigin ? formatTimestamp(status.lastSyncAt) : 'Unknown',
      promotedAt: status.edgeoneOrigin === origin ? formatTimestamp(status.lastEdgeoneCheckAt) : 'N/A',
      actionKind: 'remote',
    })
  }

  return rows
}

function adminNeedsAttention(status: HaStatus): boolean {
  return status.mode !== 'single'
    && (status.degraded || status.role !== 'full_master' || !status.allowsFullWrites)
}

export default function HaStatusBanner({
  status,
  audience,
  adminVariant = 'panel',
  onPromote,
  onFinalize,
  busy = false,
  compactHref,
  compactTitle,
  compactDescription,
  compactActionLabel,
  onCompactClick,
}: HaStatusBannerProps): JSX.Element | null {
  const admin = audience === 'admin'
  if (!status || status.mode === 'single' || (!admin && !status.degraded)) return null

  const title = status.role === 'provisional_master'
    ? 'Failover is active but not finalized'
    : status.role === 'standby'
      ? 'This node is in standby'
      : status.role === 'recovery'
        ? 'This node is in recovery'
        : 'This node is the active master'
  const detail = status.role === 'provisional_master'
    ? 'API and MCP traffic can continue. Registration, recharge, and configuration writes stay disabled until an administrator finalizes failover.'
    : status.role === 'standby'
      ? 'This node is syncing and should not handle external writes. Promote only when the current EdgeOne origin is unhealthy.'
      : status.role === 'recovery'
        ? 'Only mergeable usage, log, event, and payment notification data should be imported from this node.'
        : 'Full business writes are enabled on this node. Standby nodes should continue receiving snapshots.'
  const toneClass = status.role === 'full_master' ? 'ha-status-banner-active' : ''
  const rows = buildNodeRows(status)
  const authorityLabel = status.allowsFullWrites ? 'Full writes' : status.allowsBasicBusiness ? 'Basic traffic' : 'Writes blocked'
  const authorityTone: StatusTone = status.allowsFullWrites ? 'success' : status.allowsBasicBusiness ? 'warning' : 'neutral'

  if (admin && adminVariant === 'compact') {
    if (!adminNeedsAttention(status)) return null
    return (
      <section className="ha-status-banner ha-status-banner-compact" role="status" aria-live="polite">
        <div className="ha-status-banner-head">
          <div className="ha-status-banner-icon" aria-hidden="true">
            <CircleAlert size={20} strokeWidth={2.4} />
          </div>
          <div className="ha-status-banner-copy">
            <div className="ha-status-banner-title">{compactTitle ?? title}</div>
            <p>{compactDescription ?? detail}</p>
          </div>
          {compactHref && compactActionLabel && (
            <Button asChild size="sm" variant="outline" className="ha-status-banner-action">
              <a
                href={compactHref}
                onClick={(event) => {
                  if (!onCompactClick) return
                  event.preventDefault()
                  onCompactClick()
                }}
              >
                <span>{compactActionLabel}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      </section>
    )
  }

  if (admin) {
    return (
      <section className="ha-node-panel" aria-labelledby="ha-node-panel-title">
        <div className="ha-node-panel-head">
          <div className="ha-node-panel-title-group">
            <div className="ha-node-panel-kicker">High availability</div>
            <h2 id="ha-node-panel-title">HA service nodes</h2>
            <p>{detail}</p>
          </div>
          <div className="ha-node-panel-state">
            <StatusBadge tone={authorityTone}>{authorityLabel}</StatusBadge>
          </div>
        </div>

        <dl className="ha-status-summary" aria-label="HA routing summary">
          <div><dt>EdgeOne domain</dt><dd>{status.edgeoneDomain ?? 'Unknown'}</dd></div>
          <div><dt>Current origin</dt><dd>{status.edgeoneOrigin ?? 'Unknown'}</dd></div>
          <div><dt>Expected origin</dt><dd>{status.edgeoneExpectedOrigin ?? 'Unknown'}</dd></div>
          <div><dt>Sync lag</dt><dd>{formatLag(status.syncLagSeconds)}</dd></div>
          <div><dt>EdgeOne API</dt><dd>{status.edgeoneApiConfigured ? 'Configured' : 'Not configured'}</dd></div>
          <div><dt>Recovery</dt><dd>{status.recoveryStatus ?? 'None'}</dd></div>
        </dl>

        <div className="ha-node-list" aria-label="HA service nodes">
          <div className="ha-node-list-title">
            <Server size={18} aria-hidden="true" />
            <span>Node inventory</span>
          </div>
          <div className="ha-node-grid" role="table" aria-label="HA service node status">
            <div className="ha-node-grid-row ha-node-grid-head" role="row">
              <div role="columnheader">Node</div>
              <div role="columnheader">Role</div>
              <div role="columnheader">Origin</div>
              <div role="columnheader">Health</div>
              <div role="columnheader">Last sync</div>
              <div role="columnheader">Promoted at</div>
              <div role="columnheader">Action</div>
            </div>
            {rows.map((row) => (
              <div className="ha-node-grid-row" role="row" key={row.key}>
                <div role="cell" className="ha-node-identity">
                  <strong>{row.nodeId}</strong>
                  <span>{row.relation}</span>
                </div>
                <div role="cell">{row.role}</div>
                <div role="cell"><code>{row.origin}</code></div>
                <div role="cell"><StatusBadge tone={row.healthTone}>{row.health}</StatusBadge></div>
                <div role="cell">{row.lastSync}</div>
                <div role="cell">{row.promotedAt}</div>
                <div role="cell" className="ha-node-action">
                  {row.actionKind === 'promote' && onPromote && (
                    <Button
                      type="button"
                      size="sm"
                      variant="warning"
                      className="ha-node-action-button"
                      onClick={onPromote}
                      disabled={busy}
                    >
                      <Crown className="h-4 w-4" aria-hidden="true" />
                      Promote to master
                    </Button>
                  )}
                  {row.actionKind === 'finalize' && onFinalize && (
                    <Button
                      type="button"
                      size="sm"
                      variant="success"
                      className="ha-node-action-button"
                      onClick={onFinalize}
                      disabled={busy}
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Finalize master
                    </Button>
                  )}
                  {row.actionKind === 'serving' && (
                    <span className="ha-node-action-note">Serving</span>
                  )}
                  {row.actionKind === 'blocked' && (
                    <span className="ha-node-action-note">Recover first</span>
                  )}
                  {row.actionKind === 'remote' && (
                    <span className="ha-node-action-note">Use that node admin</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {status.message && (
          <div className="ha-status-message">
            <RotateCcw size={16} aria-hidden="true" />
            <span>{status.message}</span>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className={`ha-status-banner ${toneClass}`} role="status" aria-live="polite">
      <div className="ha-status-banner-head">
        <div className="ha-status-banner-icon" aria-hidden="true">
          <CircleAlert size={22} strokeWidth={2.4} />
        </div>
        <div className="ha-status-banner-copy">
          <div className="ha-status-banner-title">{title}</div>
          <p>{detail}</p>
        </div>
      </div>
    </section>
  )
}
