export type HaGcState =
  | 'eligible'
  | 'idle'
  | 'draining'
  | 'deferred'
  | 'recovering'
  | 'stalled'
  | 'unknown'
  | 'stale'
  | string

export interface HaChannelHealth {
  channel: 'control' | 'billing' | 'runtime'
  ackedSeq: number | null
  highWatermark: number
  ackLag: number | null
  cursorState: 'healthy' | 'catching_up' | 'baseline_required' | 'expired_backlog' | string
  retentionSecs: number
  expiredBacklog: boolean
  gcState?: HaGcState
  oldestAgeSecs: number | null
  lastProgressAt: number | null
  lastDeferReason: string | null
  nextRetryAt: number | null
  batchSize: number | null
  gcDebtMode: string
  gcObservedAt: number | null
  gcDeletedRowsPerMinute: number
  gcRecoveryDeadlineAt: number | null
  gcSloState: string
  gcForegroundRps: number
}
