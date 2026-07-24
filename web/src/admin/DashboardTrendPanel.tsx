import { useEffect, useMemo, useState } from 'react'

import type { DashboardHourlyRequestWindow } from '../api'
import SegmentedTabs from '../components/ui/SegmentedTabs'
import { Bar, Line } from 'react-chartjs-2'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
  type TooltipItem,
} from 'chart.js'
import {
  buildDashboardAreaStackLayers,
  formatDashboardRealtimeWindowLabel,
  buildRollingHourlyWindow,
  getDashboardHourlyBarChartKey,
  getCurrentPartialHourHighlightIndex,
  getVisibleHourlyWindow,
  DASHBOARD_RESULT_SERIES_ORDER,
  DASHBOARD_TYPE_SERIES_ORDER,
  DASHBOARD_CREDIT_SERIES_ORDER,
  DEFAULT_VISIBLE_CREDIT_SERIES,
  DEFAULT_VISIBLE_RESULT_SERIES,
  DEFAULT_VISIBLE_TYPE_SERIES,
  createDashboardHourlyChartPreferences,
  formatHourlyBucketLabel,
  getResultSeriesValue,
  getTypeSeriesValue,
  getCreditSeriesValue,
  readDashboardHourlyChartPreferences,
  toggleSeriesSelection,
  writeDashboardHourlyChartPreferences,
  type DashboardCreditSeriesId,
  type DashboardHourlyChartMode,
  type DashboardHourlyChartPreferences,
  type DashboardResultSeriesId,
  type DashboardTypeSeriesId,
} from './dashboardHourlyCharts'
import type { DashboardOverviewStrings } from './DashboardOverview'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend)

interface DashboardChartPalette {
  secondarySuccess: string
  primarySuccess: string
  secondaryFailure: string
  primaryFailure429: string
  primaryFailureOther: string
  unknown: string
  mcpNonBillable: string
  mcpBillable: string
  apiNonBillable: string
  apiBillable: string
  localEstimate: string
  upstreamActual: string
  grid: string
  tick: string
  zeroLine: string
  partialHourBackground: string
  partialHourDivider: string
}

function readChartColorVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? `hsl(${value})` : fallback
}

function readDashboardChartPalette(): DashboardChartPalette {
  return {
    secondarySuccess: readChartColorVar('--dashboard-chart-result-secondary-success', '#34d399'),
    primarySuccess: readChartColorVar('--dashboard-chart-result-primary-success', '#10b981'),
    secondaryFailure: readChartColorVar('--dashboard-chart-result-secondary-failure', '#f59e0b'),
    primaryFailure429: readChartColorVar('--dashboard-chart-result-primary-failure-429', '#f97316'),
    primaryFailureOther: readChartColorVar('--dashboard-chart-result-primary-failure-other', '#ef4444'),
    unknown: readChartColorVar('--dashboard-chart-result-unknown', '#94a3b8'),
    mcpNonBillable: readChartColorVar('--dashboard-chart-type-mcp-non-billable', '#67e8f9'),
    mcpBillable: readChartColorVar('--dashboard-chart-type-mcp-billable', '#22d3ee'),
    apiNonBillable: readChartColorVar('--dashboard-chart-type-api-non-billable', '#93c5fd'),
    apiBillable: readChartColorVar('--dashboard-chart-type-api-billable', '#60a5fa'),
    localEstimate: readChartColorVar('--dashboard-chart-credit-local-estimate', 'hsl(199 89% 48%)'),
    upstreamActual: readChartColorVar('--dashboard-chart-credit-upstream-actual', 'hsl(330 81% 60%)'),
    grid: readChartColorVar('--dashboard-chart-grid', 'rgba(148, 163, 184, 0.18)'),
    tick: readChartColorVar('--dashboard-chart-tick', '#cbd5e1'),
    zeroLine: readChartColorVar('--dashboard-chart-zero-line', 'rgba(148, 163, 184, 0.32)'),
    partialHourBackground: readChartColorVar('--dashboard-chart-partial-hour-background', 'rgba(148, 163, 184, 0.13)'),
    partialHourDivider: readChartColorVar('--dashboard-chart-partial-hour-divider', 'rgba(100, 116, 139, 0.52)'),
  }
}

function withOpacity(color: string, opacity: number): string {
  return color.startsWith('hsl(') && color.endsWith(')')
    ? `${color.slice(0, -1)} / ${opacity})`
    : color
}

function formatChartWindow(copy: string, count: number): string {
  return copy.replace('{count}', String(count))
}

function formatChartWindowWithLabels(
  chartMode: DashboardHourlyChartMode,
  strings: Pick<DashboardOverviewStrings, 'chartUtcWindow' | 'chartRollingWindow'>,
  count: number,
  window?: DashboardHourlyRequestWindow,
): string {
  if (chartMode === 'resultsArea' || chartMode === 'typesArea' || chartMode === 'creditsArea') {
    return formatDashboardRealtimeWindowLabel(
      strings.chartRollingWindow,
      window?.bucketSeconds ?? 0,
      window?.visibleBuckets ?? count,
      count,
    )
  }
  return formatChartWindow(strings.chartUtcWindow, count)
}

function DashboardChartSeriesButton({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean
  label: string
  color: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={`dashboard-chart-series-chip${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="dashboard-chart-series-chip-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

function isAreaChartMode(mode: DashboardHourlyChartMode): mode is 'resultsArea' | 'typesArea' | 'creditsArea' {
  return mode === 'resultsArea' || mode === 'typesArea' || mode === 'creditsArea'
}

function isCreditChartMode(mode: DashboardHourlyChartMode): mode is 'credits' | 'creditsArea' {
  return mode === 'credits' || mode === 'creditsArea'
}

function getCategorySlotBounds(chart: ChartJS<'bar'>, index: number): { left: number; right: number } | null {
  const xScale = chart.scales.x
  const labels = chart.data.labels ?? []
  if (!xScale || index < 0 || index >= labels.length) return null

  const center = xScale.getPixelForValue(index)
  if (!Number.isFinite(center)) return null

  const previousCenter = index > 0 ? xScale.getPixelForValue(index - 1) : null
  const nextCenter = index < labels.length - 1 ? xScale.getPixelForValue(index + 1) : null
  const left = previousCenter == null || !Number.isFinite(previousCenter)
    ? chart.chartArea.left
    : (previousCenter + center) / 2
  const right = nextCenter == null || !Number.isFinite(nextCenter)
    ? chart.chartArea.right
    : (center + nextCenter) / 2

  return { left, right }
}

function createCurrentPartialHourHighlightPlugin({
  index,
  backgroundColor,
  dividerColor,
}: {
  index: number
  backgroundColor: string
  dividerColor: string
}): Plugin<'bar'> {
  return {
    id: 'dashboard-current-partial-hour-highlight',
    beforeDatasetsDraw(chart) {
      const bounds = getCategorySlotBounds(chart, index)
      if (!bounds) return
      const { ctx, chartArea } = chart
      ctx.save()
      ctx.fillStyle = backgroundColor
      ctx.fillRect(
        bounds.left,
        chartArea.top,
        Math.max(0, bounds.right - bounds.left),
        Math.max(0, chartArea.bottom - chartArea.top),
      )
      ctx.restore()
    },
    afterDatasetsDraw(chart) {
      const bounds = getCategorySlotBounds(chart, index)
      if (!bounds) return
      const { ctx, chartArea } = chart
      ctx.save()
      ctx.strokeStyle = dividerColor
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(bounds.left, chartArea.top)
      ctx.lineTo(bounds.left, chartArea.bottom)
      ctx.stroke()
      ctx.restore()
    },
  }
}

export default function DashboardTrendPanel({
  strings,
  overviewReady,
  hourlyRequestWindow,
  initialChartMode = 'results',
  initialVisibleResultSeries = DEFAULT_VISIBLE_RESULT_SERIES,
  initialVisibleTypeSeries = DEFAULT_VISIBLE_TYPE_SERIES,
  initialVisibleCreditSeries = DEFAULT_VISIBLE_CREDIT_SERIES,
  chartPersistenceKey = null,
  chartLabelTimeZone = null,
}: {
  strings: DashboardOverviewStrings
  overviewReady: boolean
  hourlyRequestWindow: DashboardHourlyRequestWindow
  initialChartMode?: DashboardHourlyChartMode
  initialVisibleResultSeries?: ReadonlyArray<DashboardResultSeriesId>
  initialVisibleTypeSeries?: ReadonlyArray<DashboardTypeSeriesId>
  initialVisibleCreditSeries?: ReadonlyArray<DashboardCreditSeriesId>
  chartPersistenceKey?: string | null
  chartLabelTimeZone?: string | null
}): JSX.Element {
  const legacyChartPersistenceKeys = useMemo(
    () => (
      chartPersistenceKey === 'admin.dashboard.hourly-request-charts.v2'
        ? ['admin.dashboard.hourly-request-charts.v1']
        : []
    ),
    [chartPersistenceKey],
  )
  const initialPreferences = useMemo<DashboardHourlyChartPreferences>(() => {
    const fallback = createDashboardHourlyChartPreferences({
      chartMode: initialChartMode,
      visibleResultSeries: initialVisibleResultSeries,
      visibleTypeSeries: initialVisibleTypeSeries,
      visibleCreditSeries: initialVisibleCreditSeries,
    })
    if (typeof window === 'undefined') return fallback
    return readDashboardHourlyChartPreferences(
      window.localStorage,
      chartPersistenceKey,
      legacyChartPersistenceKeys,
    ) ?? fallback
  }, [
    chartPersistenceKey,
    initialChartMode,
    initialVisibleCreditSeries,
    initialVisibleResultSeries,
    initialVisibleTypeSeries,
    legacyChartPersistenceKeys,
  ])

  const [chartMode, setChartMode] = useState<DashboardHourlyChartMode>(initialPreferences.chartMode)
  const [visibleResultSeries, setVisibleResultSeries] = useState<DashboardResultSeriesId[]>(initialPreferences.visibleResultSeries)
  const [visibleTypeSeries, setVisibleTypeSeries] = useState<DashboardTypeSeriesId[]>(initialPreferences.visibleTypeSeries)
  const [visibleCreditSeries, setVisibleCreditSeries] = useState<DashboardCreditSeriesId[]>(initialPreferences.visibleCreditSeries)

  useEffect(() => {
    if (typeof window === 'undefined') return
    writeDashboardHourlyChartPreferences(window.localStorage, chartPersistenceKey, {
      chartMode,
      visibleResultSeries,
      visibleTypeSeries,
      visibleCreditSeries,
    })
  }, [
    chartMode,
    chartPersistenceKey,
    visibleCreditSeries,
    visibleResultSeries,
    visibleTypeSeries,
  ])

  const palette = readDashboardChartPalette()
  const visibleWindow = useMemo(
    () => getVisibleHourlyWindow(hourlyRequestWindow),
    [hourlyRequestWindow],
  )
  const isAreaMode = isAreaChartMode(chartMode)
  const isCreditMode = isCreditChartMode(chartMode)
  const rollingRangeSlots = visibleWindow.slots
  const rollingHourlyWindow = useMemo(
    () => buildRollingHourlyWindow(hourlyRequestWindow),
    [hourlyRequestWindow],
  )
  const rangeSlots = isAreaMode ? rollingRangeSlots : rollingHourlyWindow.slots
  const currentPartialHourHighlightIndex = getCurrentPartialHourHighlightIndex(chartMode, rangeSlots)
  const barChartKey = getDashboardHourlyBarChartKey(
    chartMode,
    rangeSlots,
    `${palette.partialHourBackground}:${palette.partialHourDivider}`,
  )
  const currentPartialHourPlugins = useMemo<Plugin<'bar'>[]>(
    () => currentPartialHourHighlightIndex == null
      ? []
      : [
          createCurrentPartialHourHighlightPlugin({
            index: currentPartialHourHighlightIndex,
            backgroundColor: palette.partialHourBackground,
            dividerColor: palette.partialHourDivider,
          }),
        ],
    [currentPartialHourHighlightIndex, palette.partialHourBackground, palette.partialHourDivider],
  )
  const labels = useMemo(
    () => {
      return Array.from({ length: rangeSlots.length }, (_, index) => {
        const bucketStart = rangeSlots[index]?.bucketStart
        return bucketStart == null ? ['', ''] : formatHourlyBucketLabel(bucketStart, chartLabelTimeZone ?? undefined)
      })
    },
    [chartLabelTimeZone, rangeSlots],
  )
  const resultSeriesLabels: Record<DashboardResultSeriesId, string> = {
    secondarySuccess: strings.chartResultSecondarySuccess,
    primarySuccess: strings.chartResultPrimarySuccess,
    secondaryFailure: strings.chartResultSecondaryFailure,
    primaryFailure429: strings.chartResultPrimaryFailure429,
    primaryFailureOther: strings.chartResultPrimaryFailureOther,
    unknown: strings.chartResultUnknown,
  }
  const typeSeriesLabels: Record<DashboardTypeSeriesId, string> = {
    mcpNonBillable: strings.chartTypeMcpNonBillable,
    mcpBillable: strings.chartTypeMcpBillable,
    apiNonBillable: strings.chartTypeApiNonBillable,
    apiBillable: strings.chartTypeApiBillable,
  }
  const creditSeriesLabels: Record<DashboardCreditSeriesId, string> = {
    localEstimate: strings.chartCreditLocalEstimate,
    upstreamActual: strings.chartCreditUpstreamActual,
  }
  const seriesColors: Record<DashboardResultSeriesId | DashboardTypeSeriesId | DashboardCreditSeriesId, string> = {
    secondarySuccess: palette.secondarySuccess,
    primarySuccess: palette.primarySuccess,
    secondaryFailure: palette.secondaryFailure,
    primaryFailure429: palette.primaryFailure429,
    primaryFailureOther: palette.primaryFailureOther,
    unknown: palette.unknown,
    mcpNonBillable: palette.mcpNonBillable,
    mcpBillable: palette.mcpBillable,
    apiNonBillable: palette.apiNonBillable,
    apiBillable: palette.apiBillable,
    localEstimate: palette.localEstimate,
    upstreamActual: palette.upstreamActual,
  }

  const activeSeries = useMemo(() => {
    switch (chartMode) {
      case 'results':
      case 'resultsArea':
        return visibleResultSeries
      case 'types':
      case 'typesArea':
        return visibleTypeSeries
      case 'credits':
      case 'creditsArea':
        return visibleCreditSeries
    }
  }, [chartMode, visibleCreditSeries, visibleResultSeries, visibleTypeSeries])

  const chartData = useMemo<ChartData<'bar' | 'line'>>(() => {
    if (rangeSlots.length === 0 || activeSeries.length === 0) {
      return { labels, datasets: [] }
    }

    if (chartMode === 'results') {
      return {
        labels,
        datasets: activeSeries.map((seriesId) => ({
          label: resultSeriesLabels[seriesId as DashboardResultSeriesId],
          data: labels.map((_, index) => {
            const bucket = rangeSlots[index]?.bucket ?? null
            return bucket ? getResultSeriesValue(bucket, seriesId as DashboardResultSeriesId) : null
          }),
          backgroundColor: seriesColors[seriesId as DashboardResultSeriesId],
          borderRadius: 4,
          borderSkipped: false,
          stack: 'requests',
        })),
      }
    }

    if (chartMode === 'types') {
      return {
        labels,
        datasets: activeSeries.map((seriesId) => ({
          label: typeSeriesLabels[seriesId as DashboardTypeSeriesId],
          data: labels.map((_, index) => {
            const bucket = rangeSlots[index]?.bucket ?? null
            return bucket ? getTypeSeriesValue(bucket, seriesId as DashboardTypeSeriesId) : null
          }),
          backgroundColor: seriesColors[seriesId as DashboardTypeSeriesId],
          borderRadius: 4,
          borderSkipped: false,
          stack: 'requests',
        })),
      }
    }

    if (chartMode === 'credits') {
      return {
        labels,
        datasets: activeSeries.map((seriesId) => ({
          label: creditSeriesLabels[seriesId as DashboardCreditSeriesId],
          data: labels.map((_, index) => {
            const bucket = rangeSlots[index]?.bucket ?? null
            return bucket ? getCreditSeriesValue(bucket, seriesId as DashboardCreditSeriesId) : null
          }),
          backgroundColor: seriesColors[seriesId as DashboardCreditSeriesId],
          borderRadius: 4,
          borderSkipped: false,
        })),
      }
    }

    if (chartMode === 'resultsArea') {
      return {
        labels,
        datasets: buildDashboardAreaStackLayers(activeSeries as DashboardResultSeriesId[]).map((layer) => {
          const seriesId = layer.seriesId
          return {
            type: 'line' as const,
            label: resultSeriesLabels[seriesId],
            data: labels.map((_, index) => {
              const bucket = rangeSlots[index]?.bucket ?? null
              return bucket ? getResultSeriesValue(bucket, seriesId) : null
            }),
            borderColor: seriesColors[seriesId],
            backgroundColor: withOpacity(seriesColors[seriesId], 0.22),
            fill: layer.fill,
            borderWidth: layer.borderWidth,
            pointRadius: layer.pointRadius,
            pointHoverRadius: layer.pointHoverRadius,
            tension: layer.tension,
            spanGaps: layer.spanGaps,
            stack: layer.stack,
          }
        }),
      }
    }

    if (chartMode === 'typesArea') {
      return {
        labels,
        datasets: buildDashboardAreaStackLayers(activeSeries as DashboardTypeSeriesId[]).map((layer) => {
          const seriesId = layer.seriesId
          return {
            type: 'line' as const,
            label: typeSeriesLabels[seriesId],
            data: labels.map((_, index) => {
              const bucket = rangeSlots[index]?.bucket ?? null
              return bucket ? getTypeSeriesValue(bucket, seriesId) : null
            }),
            borderColor: seriesColors[seriesId],
            backgroundColor: withOpacity(seriesColors[seriesId], 0.22),
            fill: layer.fill,
            borderWidth: layer.borderWidth,
            pointRadius: layer.pointRadius,
            pointHoverRadius: layer.pointHoverRadius,
            tension: layer.tension,
            spanGaps: layer.spanGaps,
            stack: layer.stack,
          }
        }),
      }
    }

    return {
      labels,
      datasets: activeSeries.map((seriesId) => ({
        type: 'line' as const,
        label: creditSeriesLabels[seriesId as DashboardCreditSeriesId],
        data: labels.map((_, index) => {
          const bucket = rangeSlots[index]?.bucket ?? null
          return bucket ? getCreditSeriesValue(bucket, seriesId as DashboardCreditSeriesId) : null
        }),
        borderColor: seriesColors[seriesId as DashboardCreditSeriesId],
        backgroundColor: withOpacity(seriesColors[seriesId as DashboardCreditSeriesId], 0.2),
        fill: 'origin',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.18,
        spanGaps: false,
      })),
    }
  }, [activeSeries, chartMode, creditSeriesLabels, labels, rangeSlots, resultSeriesLabels, seriesColors, typeSeriesLabels])

  const chartOptions = useMemo<ChartOptions<'bar' | 'line'>>(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 560,
        easing: 'easeOutCubic',
      },
      plugins: {
        legend: { display: false },
        filler: {
          propagate: false,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label(context: TooltipItem<'bar' | 'line'>) {
              const prefix = `${context.dataset.label}: `
              if (context.raw == null) return `${prefix}—`
              const value = typeof context.raw === 'number' ? context.raw : Number(context.raw)
              return prefix + value
            },
          },
        },
      },
      scales: {
        x: {
          stacked: !isCreditMode,
          grid: { display: false },
          ticks: {
            color: palette.tick,
            maxRotation: 0,
            autoSkipPadding: 14,
          },
        },
        y: {
          stacked: !isCreditMode,
          beginAtZero: true,
          ticks: {
            color: palette.tick,
          },
          grid: {
            color(context) {
              return Number(context.tick.value) === 0 ? palette.zeroLine : palette.grid
            },
          },
        },
      },
    }
  }, [isCreditMode, palette.grid, palette.tick, palette.zeroLine])

  const barChartData = chartData as ChartData<'bar'>
  const lineChartData = chartData as ChartData<'line'>
  const barChartOptions = chartOptions as ChartOptions<'bar'>
  const lineChartOptions = chartOptions as ChartOptions<'line'>

  const modeOptions = [
    { value: 'results' as const, label: strings.chartModeResults },
    { value: 'types' as const, label: strings.chartModeTypes },
    { value: 'credits' as const, label: strings.chartModeCredits },
    { value: 'resultsArea' as const, label: strings.chartModeResultsArea },
    { value: 'typesArea' as const, label: strings.chartModeTypesArea },
    { value: 'creditsArea' as const, label: strings.chartModeCreditsArea },
  ]

  const showEmpty = overviewReady && (rangeSlots.length === 0 || activeSeries.length === 0)
  const chartSeriesLabel = strings.chartVisibleSeries
  const chartMeta = formatChartWindowWithLabels(
    chartMode,
    strings,
    rangeSlots.length,
    hourlyRequestWindow,
  )

  return (
    <section className="surface panel dashboard-trend-panel">
      <div className="panel-header dashboard-trend-header">
        <div>
          <h2>{strings.trendsTitle}</h2>
          <p className="panel-description">{strings.trendsDescription}</p>
        </div>
        <div className="dashboard-trend-meta">{chartMeta}</div>
      </div>

      <SegmentedTabs<DashboardHourlyChartMode>
        className="dashboard-trend-segmented"
        value={chartMode}
        onChange={setChartMode}
        options={modeOptions}
        ariaLabel={strings.trendsTitle}
      />

      <div className="dashboard-chart-toolbar">
        <span className="dashboard-chart-toolbar-label">{chartSeriesLabel}</span>
        <div className="dashboard-chart-series-list" role="group" aria-label={chartSeriesLabel}>
          {(chartMode === 'results' || chartMode === 'resultsArea'
            ? DASHBOARD_RESULT_SERIES_ORDER.map((seriesId) => (
                <DashboardChartSeriesButton
                  key={seriesId}
                  active={visibleResultSeries.includes(seriesId)}
                  label={resultSeriesLabels[seriesId]}
                  color={seriesColors[seriesId]}
                  onClick={() => setVisibleResultSeries((current) => toggleSeriesSelection(current, seriesId))}
                />
              ))
            : chartMode === 'types' || chartMode === 'typesArea'
              ? DASHBOARD_TYPE_SERIES_ORDER.map((seriesId) => (
                  <DashboardChartSeriesButton
                    key={seriesId}
                    active={visibleTypeSeries.includes(seriesId)}
                    label={typeSeriesLabels[seriesId]}
                    color={seriesColors[seriesId]}
                    onClick={() => setVisibleTypeSeries((current) => toggleSeriesSelection(current, seriesId))}
                  />
                ))
              : DASHBOARD_CREDIT_SERIES_ORDER.map((seriesId) => (
                      <DashboardChartSeriesButton
                        key={seriesId}
                        active={visibleCreditSeries.includes(seriesId)}
                        label={creditSeriesLabels[seriesId]}
                        color={seriesColors[seriesId]}
                        onClick={() => setVisibleCreditSeries((current) => toggleSeriesSelection(current, seriesId))}
                      />
                    )))}
        </div>
      </div>

      <div className="dashboard-chart-shell">
        {!overviewReady ? (
          <div className="empty-state alert">{strings.loading}</div>
        ) : showEmpty ? (
          <div className="empty-state alert">{strings.chartEmpty}</div>
        ) : (
          <div className="dashboard-chart-canvas">
            {isAreaMode ? (
              <Line options={lineChartOptions} data={lineChartData} />
            ) : (
              <Bar
                key={barChartKey}
                options={barChartOptions}
                data={barChartData}
                plugins={currentPartialHourPlugins}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
