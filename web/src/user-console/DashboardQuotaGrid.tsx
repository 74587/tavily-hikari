import type { RequestRate } from '../api'

interface DashboardQuotaGridText {
  hourly: string
  daily: string
  monthly: string
}

interface DashboardQuotaGridProps {
  text: DashboardQuotaGridText
  rateLabel: string
  rate: RequestRate
  hourlyUsed: number
  hourlyLimit: number
  dailyUsed: number
  dailyLimit: number
  monthlyUsed: number
  monthlyLimit: number
  formatNumber: (value: number) => string
}

export default function DashboardQuotaGrid({
  text,
  rateLabel,
  rate,
  hourlyUsed,
  hourlyLimit,
  dailyUsed,
  dailyLimit,
  monthlyUsed,
  monthlyLimit,
  formatNumber,
}: DashboardQuotaGridProps): JSX.Element {
  return (
    <div className="access-stats">
      <div className="access-stat quota-stat-card">
        <div className="quota-stat-label">{rateLabel}</div>
        <div className="quota-stat-value">
          {formatNumber(rate.used)}
          <span>/ {formatNumber(rate.limit)}</span>
        </div>
      </div>
      <div className="access-stat quota-stat-card">
        <div className="quota-stat-label">{text.hourly}</div>
        <div className="quota-stat-value">
          {formatNumber(hourlyUsed)}
          <span>/ {formatNumber(hourlyLimit)}</span>
        </div>
      </div>
      <div className="access-stat quota-stat-card">
        <div className="quota-stat-label">{text.daily}</div>
        <div className="quota-stat-value">
          {formatNumber(dailyUsed)}
          <span>/ {formatNumber(dailyLimit)}</span>
        </div>
      </div>
      <div className="access-stat quota-stat-card">
        <div className="quota-stat-label">{text.monthly}</div>
        <div className="quota-stat-value">
          {formatNumber(monthlyUsed)}
          <span>/ {formatNumber(monthlyLimit)}</span>
        </div>
      </div>
    </div>
  )
}
