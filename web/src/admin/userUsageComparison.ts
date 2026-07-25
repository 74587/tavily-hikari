import type { AdminTranslations, Language } from '../i18n'

export function formatShadowDailyUsageComparison(args: {
  actualUsed: number
  shadowUsed: number | null
  usersStrings: AdminTranslations['users']
  formatNumber: (value: number) => string
}): string | null {
  const { actualUsed, shadowUsed, usersStrings, formatNumber } = args
  if (shadowUsed == null) return null

  const delta = shadowUsed - actualUsed
  if (delta === 0) return null
  const deltaText = `${delta >= 0 ? '+' : '-'}${formatNumber(Math.abs(delta))}`

  return usersStrings.usage.shadowComparisonValue.replace('{delta}', deltaText)
}

export function buildShadowDailyUsageStack(args: {
  actualUsed: number
  shadowUsed: number | null
  shadowAvailability: 'confirmed' | 'projected' | 'unavailable' | null
  observedPeriodCount?: number | null
  settledPeriodCount?: number | null
  degradedPeriodCount?: number | null
  language: Language
  limit: number
  usersStrings: AdminTranslations['users']
  formatNumber: (value: number) => string
  formatQuotaStackValue: (
    used: number,
    limit: number,
  ) => {
    primary: string
    secondary?: string | null
    primaryClassName?: string | null
  }
}): {
  primary: string
  secondary?: string | null
  primaryClassName?: string | null
} {
  const {
    actualUsed,
    shadowUsed,
    shadowAvailability,
    observedPeriodCount,
    settledPeriodCount,
    degradedPeriodCount,
    language,
    limit,
    usersStrings,
    formatNumber,
    formatQuotaStackValue,
  } = args
  const coverage = observedPeriodCount == null || settledPeriodCount == null
    ? null
    : `${language === 'zh' ? '标准对账' : 'Standard reconciled'} ${formatNumber(settledPeriodCount)}/${formatNumber(observedPeriodCount)}${degradedPeriodCount ? ` · ${language === 'zh' ? '降级' : 'Degraded'} ${formatNumber(degradedPeriodCount)}` : ''}`
  const withCoverage = (secondary: string | null): string | null => [secondary, coverage].filter(Boolean).join(' · ') || null

  if (shadowAvailability === 'unavailable') {
    return {
      primary: usersStrings.usage.shadowUnavailable,
      secondary: null,
    }
  }
  if (shadowAvailability !== 'confirmed' || shadowUsed == null) {
    if (shadowAvailability === 'projected' && shadowUsed != null) {
      const shadowMetric = formatQuotaStackValue(shadowUsed, limit)
      const comparison = formatShadowDailyUsageComparison({
        actualUsed,
        shadowUsed,
        usersStrings,
        formatNumber,
      })
      return {
        primary: shadowMetric.primary,
        primaryClassName: shadowMetric.primaryClassName ?? null,
        secondary: withCoverage(comparison
          ? `${comparison} · ${usersStrings.usage.shadowProjectedEstimate}`
          : usersStrings.usage.shadowProjectedEstimate),
      }
    }
    return {
      primary: '—',
      secondary: null,
    }
  }

  const shadowMetric = formatQuotaStackValue(shadowUsed, limit)
  return {
    primary: shadowMetric.primary,
    primaryClassName: shadowMetric.primaryClassName ?? null,
    secondary: withCoverage(formatShadowDailyUsageComparison({
      actualUsed,
      shadowUsed,
      usersStrings,
      formatNumber,
    })),
  }
}
