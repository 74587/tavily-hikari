export const DEFAULT_RECHARGE_UNIT_CREDITS = 1000

export function clampRechargeStep(value: number, min: number, max: number, step: number): number {
  const safeMin = Number.isFinite(min) ? min : 0
  const safeMax = Number.isFinite(max) ? Math.max(safeMin, max) : safeMin
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1
  const clamped = Math.min(safeMax, Math.max(safeMin, value))
  return safeMin + Math.round((clamped - safeMin) / safeStep) * safeStep
}
