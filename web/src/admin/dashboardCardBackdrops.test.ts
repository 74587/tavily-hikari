import { describe, expect, it } from 'bun:test'

import { buildDashboardHourlyRequestWindowFixture } from './dashboardHourlyCharts'
import {
  buildBackdropBaseline,
  buildHourlyBackdropSeries,
  buildMonthSeriesBackdropSeries,
  buildPeriodBackdropSeries,
} from './dashboardCardBackdrops'

describe('dashboardCardBackdrops helpers', () => {
  it('uses explicit comparison window bounds instead of a fixed 24h offset', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      mapBucket: ({ index, bucket }) => ({
        secondarySuccess:
          index === 0 ? 10
            : index === 1 ? 20
              : index === 25 ? 100
                : index === 26 ? 200
                  : bucket.secondarySuccess,
      }),
    })

    const currentRangeStart = window.buckets[25]?.bucketStart ?? currentHourStart
    const currentRangeEnd = window.buckets[27]?.bucketStart ?? currentHourStart
    const comparisonRangeStart = window.buckets[0]?.bucketStart ?? currentHourStart
    const comparisonRangeEnd = window.buckets[2]?.bucketStart ?? currentHourStart

    const { current, comparison } = buildHourlyBackdropSeries(
      window,
      currentRangeStart,
      currentRangeEnd,
      'otherSuccess',
      comparisonRangeStart,
      comparisonRangeEnd,
    )

    expect(current).toEqual([100, 200])
    expect(comparison).toEqual([10, 20])
  })

  it('leaves missing backdrop buckets empty instead of zero-filling them', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 12, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      retainedBuckets: 2,
      mapBucket: ({ index }) => ({
        secondarySuccess: index === 0 ? 10 : 20,
      }),
    })

    const { current, comparison } = buildHourlyBackdropSeries(
      window,
      currentHourStart - 3600,
      currentHourStart + 2 * 3600,
      'otherSuccess',
      currentHourStart - 3600,
      currentHourStart + 2 * 3600,
    )

    expect(current).toEqual([10, 20, null])
    expect(comparison).toEqual([10, 20, null])
  })

  it('keeps a month-to-date baseline when retained buckets cover only part of the month', () => {
    expect(buildBackdropBaseline(150, [null, 12, null, 8])).toBe(130)
  })

  it('keeps the today backdrop on the full natural-day axis with future slots empty', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 13, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      retainedBuckets: 49,
      mapBucket: ({ index, bucketStart, bucket }) => ({
        total: bucketStart >= Date.UTC(2026, 3, 7, 0, 0, 0) / 1000 && bucketStart <= currentHourStart
          ? index + 1
          : bucket.total,
      }),
    })

    const todayStart = Date.UTC(2026, 3, 7, 0, 0, 0) / 1000
    const todayEnd = Date.UTC(2026, 3, 7, 13, 11, 20) / 1000
    const todayPeriodEnd = Date.UTC(2026, 3, 8, 0, 0, 0) / 1000
    const yesterdayStart = Date.UTC(2026, 3, 6, 0, 0, 0) / 1000
    const yesterdayPeriodEnd = todayStart

    const { current, comparison } = buildPeriodBackdropSeries({
      hourlyRequestWindow: window,
      currentValueRange: { rangeStart: todayStart, rangeEnd: todayEnd },
      currentDisplayRange: { rangeStart: todayStart, rangeEnd: todayPeriodEnd },
      comparisonValueRange: { rangeStart: yesterdayStart, rangeEnd: yesterdayPeriodEnd },
      comparisonDisplayRange: { rangeStart: yesterdayStart, rangeEnd: yesterdayPeriodEnd },
      displayBucketSeconds: 3600,
      metricKey: 'total',
    })

    expect(current).toHaveLength(24)
    expect(comparison).toHaveLength(24)
    expect(current.slice(14).every((value) => value == null)).toBe(true)
    expect(comparison.every((value) => value == null || typeof value === 'number')).toBe(true)
    expect(current[13]).not.toBeNull()
    expect(comparison[13]).not.toBeNull()
  })

  it('keeps the month backdrop on the full natural-month axis with future days empty', () => {
    const currentHourStart = Date.UTC(2026, 3, 7, 13, 0, 0) / 1000
    const window = buildDashboardHourlyRequestWindowFixture({
      currentHourStart,
      retainedBuckets: 49,
      mapBucket: ({ bucketStart, bucket }) => ({
        total: bucketStart >= Date.UTC(2026, 3, 1, 0, 0, 0) / 1000 && bucketStart <= currentHourStart
          ? bucket.total + 1
          : bucket.total,
      }),
    })

    const monthStart = Date.UTC(2026, 3, 1, 0, 0, 0) / 1000
    const monthEnd = Date.UTC(2026, 3, 7, 13, 11, 20) / 1000
    const monthPeriodEnd = Date.UTC(2026, 4, 1, 0, 0, 0) / 1000
    const previousMonthStart = Date.UTC(2026, 2, 1, 0, 0, 0) / 1000
    const previousMonthEnd = monthStart

    const { current, comparison } = buildPeriodBackdropSeries({
      hourlyRequestWindow: window,
      currentValueRange: { rangeStart: monthStart, rangeEnd: monthEnd },
      currentDisplayRange: { rangeStart: monthStart, rangeEnd: monthPeriodEnd },
      comparisonValueRange: { rangeStart: previousMonthStart, rangeEnd: previousMonthEnd },
      comparisonDisplayRange: { rangeStart: previousMonthStart, rangeEnd: previousMonthEnd },
      displayBucketSeconds: 24 * 3600,
      metricKey: 'total',
    })

    expect(current).toHaveLength(31)
    expect(comparison).toHaveLength(31)
    expect(current.slice(7).every((value) => value == null)).toBe(true)
    expect(comparison.slice(0, 5).every((value) => value == null)).toBe(true)
    expect(current[4]).not.toBeNull()
  })

  it('builds month backdrops from cumulative month series while preserving future null slots', () => {
    const monthSeries = {
      current: [
        { bucketStart: 1, displayBucketStart: 1, total: 100, valuableSuccess: 60, valuableFailure: 12, otherSuccess: 20, otherFailure: 5, unknown: 3, upstreamExhausted: 0, newKeys: 0, newQuarantines: 0 },
        { bucketStart: 2, displayBucketStart: 2, total: 260, valuableSuccess: 150, valuableFailure: 28, otherSuccess: 51, otherFailure: 19, unknown: 12, upstreamExhausted: 1, newKeys: 1, newQuarantines: 0 },
        { bucketStart: 3, displayBucketStart: 3, total: null, valuableSuccess: null, valuableFailure: null, otherSuccess: null, otherFailure: null, unknown: null, upstreamExhausted: null, newKeys: null, newQuarantines: null },
      ],
      comparison: [
        { bucketStart: 11, displayBucketStart: 11, total: 90, valuableSuccess: 54, valuableFailure: 10, otherSuccess: 18, otherFailure: 5, unknown: 3, upstreamExhausted: 0, newKeys: 0, newQuarantines: 0 },
        { bucketStart: 12, displayBucketStart: 12, total: 210, valuableSuccess: 126, valuableFailure: 24, otherSuccess: 40, otherFailure: 12, unknown: 8, upstreamExhausted: 1, newKeys: 0, newQuarantines: 0 },
      ],
    }

    const totalBackdrop = buildMonthSeriesBackdropSeries(monthSeries, 'total')
    const newKeysBackdrop = buildMonthSeriesBackdropSeries(monthSeries, 'newKeys')

    expect(totalBackdrop.current).toEqual([100, 160, null])
    expect(totalBackdrop.comparison).toEqual([90, 120, null])
    expect(newKeysBackdrop.current).toEqual([0, 1, null])
  })
})
