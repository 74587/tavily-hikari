import type {
  DashboardHourlyRequestBucket,
  DashboardHourlyRequestWindow,
  SummaryWindowMetrics,
  SummaryWindowsResponse,
} from '../api'
import { buildHourlyRangeSlots } from './dashboardHourlyCharts'

export type DashboardBackdropMetricKey =
  | 'total'
  | 'valuableSuccess'
  | 'valuableFailure'
  | 'otherSuccess'
  | 'otherFailure'
  | 'unknown'
  | 'upstreamExhausted'
  | 'newKeys'
  | 'newQuarantines'

export interface DashboardCardBackdropSeries {
  current: Array<number | null>
  comparison: Array<number | null>
  baseline?: number
  color?: string
  comparisonColor?: string
}

export type DashboardCardBackdropMap = Partial<Record<DashboardBackdropMetricKey, DashboardCardBackdropSeries>>

export function buildBackdropBaseline(total: number, values: ReadonlyArray<number | null>): number {
  const visibleTotal = values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  return Math.max(total - visibleTotal, 0)
}

export function buildMonthBackdropBaseline(
  month: SummaryWindowMetrics,
  metricKey: DashboardBackdropMetricKey,
  values: ReadonlyArray<number | null>,
): number {
  return buildBackdropBaseline(getSummaryMetricValue(month, metricKey), values)
}

export function getPreviousMonthRange(summaryWindows: SummaryWindowsResponse): { rangeStart: number; rangeEnd: number } {
  const rangeStart = summaryWindows.previous_month_start
  const rangeEnd = summaryWindows.previous_month_end
  if (Number.isFinite(rangeStart) && Number.isFinite(rangeEnd) && rangeEnd! > rangeStart!) {
    return { rangeStart: rangeStart!, rangeEnd: rangeEnd! }
  }
  return { rangeStart: summaryWindows.month_start, rangeEnd: summaryWindows.month_start }
}

function getSummaryMetricValue(month: SummaryWindowMetrics, metricKey: DashboardBackdropMetricKey): number {
  switch (metricKey) {
    case 'total':
      return month.total_requests
    case 'valuableSuccess':
      return month.valuable_success_count
    case 'valuableFailure':
      return month.valuable_failure_count
    case 'otherSuccess':
      return month.other_success_count
    case 'otherFailure':
      return month.other_failure_count
    case 'unknown':
      return month.unknown_count
    default:
      return 0
  }
}

export function getBackdropMetricKey(id: string): DashboardBackdropMetricKey | null {
  const normalizedId = id.replace(/^(today|month)-/, '')
  switch (normalizedId) {
    case 'total':
      return 'total'
    case 'valuable-success':
      return 'valuableSuccess'
    case 'valuable-failure':
      return 'valuableFailure'
    case 'other-success':
      return 'otherSuccess'
    case 'other-failure':
      return 'otherFailure'
    case 'unknown':
      return 'unknown'
    case 'upstream-exhausted':
      return 'upstreamExhausted'
    case 'new-keys':
      return 'newKeys'
    case 'new-quarantines':
      return 'newQuarantines'
    default:
      return null
  }
}

export function buildHourlyBackdropSeries(
  hourlyRequestWindow: DashboardHourlyRequestWindow,
  rangeStart: number,
  rangeEnd: number,
  metricKey: DashboardBackdropMetricKey = 'total',
  comparisonRangeStart = rangeStart,
  comparisonRangeEnd = rangeEnd,
): { current: Array<number | null>; comparison: Array<number | null> } {
  const visibleSlots = buildHourlyRangeSlots(hourlyRequestWindow, rangeStart, rangeEnd)
  const comparisonSlots = buildHourlyRangeSlots(hourlyRequestWindow, comparisonRangeStart, comparisonRangeEnd)
  const slotCount = Math.max(visibleSlots.length, comparisonSlots.length)
  const current = Array.from({ length: slotCount }, (_, index) => {
    const bucket = visibleSlots[index]?.bucket ?? null
    return bucket ? getBackdropMetricValue(bucket, metricKey) : null
  })
  const comparison = Array.from({ length: slotCount }, (_, index) => {
    const comparisonBucket = comparisonSlots[index]?.bucket ?? null
    return comparisonBucket ? getBackdropMetricValue(comparisonBucket, metricKey) : null
  })
  return { current, comparison }
}

function getBackdropMetricValue(
  bucket: DashboardHourlyRequestBucket,
  metricKey: DashboardBackdropMetricKey,
): number {
  switch (metricKey) {
    case 'total':
      return (
        bucket.secondarySuccess
        + bucket.primarySuccess
        + bucket.secondaryFailure
        + bucket.primaryFailure429
        + bucket.primaryFailureOther
        + bucket.unknown
      )
    case 'valuableSuccess':
      return bucket.primarySuccess
    case 'valuableFailure':
      return bucket.primaryFailure429 + bucket.primaryFailureOther
    case 'otherSuccess':
      return bucket.secondarySuccess
    case 'otherFailure':
      return bucket.secondaryFailure
    case 'unknown':
      return bucket.unknown
    case 'upstreamExhausted':
      return bucket.primaryFailure429
    case 'newKeys':
      return Math.max(0, Math.round((bucket.primarySuccess + bucket.secondarySuccess) / 220))
    case 'newQuarantines':
      return Math.max(0, Math.round((bucket.primaryFailure429 + bucket.primaryFailureOther + bucket.secondaryFailure) / 90))
  }
}
