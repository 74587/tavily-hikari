import type { ReactNode } from 'react'

import { cn } from '../lib/utils'

import { Input } from './ui/input'

interface DateTimeRangeFieldProps {
  label: ReactNode
  inputType?: 'date' | 'month'
  hideLabel?: boolean
  startId: string
  endId: string
  startLabel: ReactNode
  endLabel: ReactNode
  startValue: string
  endValue: string
  startSeparator: ReactNode
  startMax?: string
  endMin?: string
  disabled?: boolean
  className?: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}

export default function DateTimeRangeField({
  label,
  inputType = 'date',
  hideLabel = false,
  startId,
  endId,
  startLabel,
  endLabel,
  startValue,
  endValue,
  startSeparator,
  startMax,
  endMin,
  disabled = false,
  className,
  onStartChange,
  onEndChange,
}: DateTimeRangeFieldProps): JSX.Element {
  return (
    <div className={cn('date-time-range-field', className)}>
      <div className={cn('date-time-range-field__label', hideLabel && 'sr-only')}>{label}</div>

      <div className="date-time-range-field__control">
        <div className="date-time-range-field__segment date-time-range-field__segment--start">
          <label className="sr-only" htmlFor={startId}>
            {startLabel}
          </label>
          <Input
            id={startId}
            type={inputType}
            value={startValue}
            onChange={(event) => onStartChange(event.target.value)}
            max={startMax || undefined}
            disabled={disabled}
            className="date-time-range-field__input focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="date-time-range-field__separator" aria-hidden="true">
          {startSeparator}
        </div>

        <div className="date-time-range-field__segment date-time-range-field__segment--end">
          <label className="sr-only" htmlFor={endId}>
            {endLabel}
          </label>
          <Input
            id={endId}
            type={inputType}
            value={endValue}
            onChange={(event) => onEndChange(event.target.value)}
            min={endMin || undefined}
            disabled={disabled}
            className="date-time-range-field__input focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>
    </div>
  )
}
