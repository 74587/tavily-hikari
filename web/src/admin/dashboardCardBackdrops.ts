import type {
  DashboardHourlyRequestBucket,
  DashboardHourlyRequestWindow,
  DashboardMonthSeries,
  DashboardMonthSeriesPoint,
  SummaryWindowMetrics,
} from '../api'
import { buildHourlyRangeSlots, getHourlyBucketsInRange } from './dashboardHourlyCharts'

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

interface DashboardBackdropRange {
  rangeStart: number
  rangeEnd: number
}

interface DashboardPeriodBackdropSeriesOptions {
  hourlyRequestWindow: DashboardHourlyRequestWindow
  currentValueRange: DashboardBackdropRange
  currentDisplayRange: DashboardBackdropRange
  comparisonValueRange?: DashboardBackdropRange
  comparisonDisplayRange?: DashboardBackdropRange
  displayBucketSeconds: number
  metricKey?: DashboardBackdropMetricKey
}

function buildPeriodRangeValues(
  hourlyRequestWindow: DashboardHourlyRequestWindow,
  valueRange: DashboardBackdropRange,
  displayRange: DashboardBackdropRange,
  metricKey: DashboardBackdropMetricKey,
  displayBucketSeconds: number,
): Array<number | null> {
  if (
    !Number.isFinite(valueRange.rangeStart)
    || !Number.isFinite(valueRange.rangeEnd)
    || valueRange.rangeEnd <= valueRange.rangeStart
    || !Number.isFinite(displayRange.rangeStart)
    || !Number.isFinite(displayRange.rangeEnd)
    || displayRange.rangeEnd <= displayRange.rangeStart
    || !Number.isFinite(displayBucketSeconds)
    || displayBucketSeconds <= 0
  ) {
    return []
  }

  const values: Array<number | null> = []
  for (let slotStart = displayRange.rangeStart; slotStart < displayRange.rangeEnd; slotStart += displayBucketSeconds) {
    const slotEnd = Math.min(slotStart + displayBucketSeconds, displayRange.rangeEnd)
    if (slotEnd <= valueRange.rangeStart || slotStart >= valueRange.rangeEnd) {
      values.push(null)
      continue
    }

    const bucketsInSlot = getHourlyBucketsInRange(
      hourlyRequestWindow,
      Math.max(slotStart, valueRange.rangeStart),
      Math.min(slotEnd, valueRange.rangeEnd),
    )
    if (bucketsInSlot.length === 0) {
      values.push(null)
      continue
    }

    let slotTotal = 0
    let hasVisibleBucket = false
    for (const bucket of bucketsInSlot) {
      slotTotal += getBackdropMetricValue(bucket, metricKey)
      hasVisibleBucket = true
    }
    values.push(hasVisibleBucket ? slotTotal : null)
  }
  return values
}

export function buildPeriodBackdropSeries(
  options: DashboardPeriodBackdropSeriesOptions,
): { current: Array<number | null>; comparison: Array<number | null> } {
  const metricKey = options.metricKey ?? 'total'
  const current = buildPeriodRangeValues(
    options.hourlyRequestWindow,
    options.currentValueRange,
    options.currentDisplayRange,
    metricKey,
    options.displayBucketSeconds,
  )
  const comparison = options.comparisonValueRange && options.comparisonDisplayRange
    ? buildPeriodRangeValues(
      options.hourlyRequestWindow,
      options.comparisonValueRange,
      options.comparisonDisplayRange,
      metricKey,
      options.displayBucketSeconds,
    )
    : []
  const slotCount = Math.max(current.length, comparison.length)
  return {
    current: Array.from({ length: slotCount }, (_, index) => current[index] ?? null),
    comparison: Array.from({ length: slotCount }, (_, index) => comparison[index] ?? null),
  }
}

function getMonthSeriesMetricValue(
  point: DashboardMonthSeriesPoint,
  metricKey: DashboardBackdropMetricKey,
): number | null {
  switch (metricKey) {
    case 'total':
      return point.total
    case 'valuableSuccess':
      return point.valuableSuccess
    case 'valuableFailure':
      return point.valuableFailure
    case 'otherSuccess':
      return point.otherSuccess
    case 'otherFailure':
      return point.otherFailure
    case 'unknown':
      return point.unknown
    case 'upstreamExhausted':
      return point.upstreamExhausted
    case 'newKeys':
      return point.newKeys
    case 'newQuarantines':
      return point.newQuarantines
  }
}

function buildMonthSeriesIncrements(
  points: ReadonlyArray<DashboardMonthSeriesPoint>,
  metricKey: DashboardBackdropMetricKey,
): Array<number | null> {
  let previous: number | null = null
  return points.map((point) => {
    const current = getMonthSeriesMetricValue(point, metricKey)
    if (current == null) {
      return null
    }
    const increment = previous == null ? current : current - previous
    previous = current
    return Math.max(0, increment)
  })
}

export function buildMonthSeriesBackdropSeries(
  monthSeries: DashboardMonthSeries,
  metricKey: DashboardBackdropMetricKey = 'total',
): { current: Array<number | null>; comparison: Array<number | null> } {
  const current = buildMonthSeriesIncrements(monthSeries.current, metricKey)
  const comparison = buildMonthSeriesIncrements(monthSeries.comparison, metricKey)
  const slotCount = Math.max(current.length, comparison.length)
  return {
    current: Array.from({ length: slotCount }, (_, index) => current[index] ?? null),
    comparison: Array.from({ length: slotCount }, (_, index) => comparison[index] ?? null),
  }
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
