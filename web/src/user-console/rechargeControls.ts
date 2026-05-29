export const DEFAULT_RECHARGE_UNIT_CREDITS = 1000
export const TEST_RECHARGE_CREDITS = 1
export const TEST_RECHARGE_MONTHS = 1
export const TEST_RECHARGE_AMOUNT_LDC = 1

export interface RechargeStepConfig {
  minCredits: number
  maxCredits: number
  creditsStep: number
  minMonths: number
  maxMonths: number
  testPriceEnabled: boolean
}

export function clampRechargeStep(value: number, min: number, max: number, step: number): number {
  const safeMin = Number.isFinite(min) ? min : 0
  const safeMax = Number.isFinite(max) ? Math.max(safeMin, max) : safeMin
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1
  const clamped = Math.min(safeMax, Math.max(safeMin, value))
  return safeMin + Math.round((clamped - safeMin) / safeStep) * safeStep
}

export function isTestRechargeSelection(credits: number, months: number): boolean {
  return credits === TEST_RECHARGE_CREDITS && months === TEST_RECHARGE_MONTHS
}

export function normalizeRechargeCredits(value: number, config: RechargeStepConfig): number {
  if (config.testPriceEnabled && value < config.minCredits) return TEST_RECHARGE_CREDITS
  return clampRechargeStep(value, config.minCredits, config.maxCredits, config.creditsStep)
}

export function nextRechargeCredits(
  value: number,
  direction: -1 | 1,
  config: RechargeStepConfig,
): number {
  const current = normalizeRechargeCredits(value, config)
  if (!config.testPriceEnabled) {
    return clampRechargeStep(
      current + direction * config.creditsStep,
      config.minCredits,
      config.maxCredits,
      config.creditsStep,
    )
  }
  if (direction < 0 && current <= config.minCredits) return TEST_RECHARGE_CREDITS
  if (direction > 0 && current < config.minCredits) return config.minCredits
  return clampRechargeStep(
    current + direction * config.creditsStep,
    config.minCredits,
    config.maxCredits,
    config.creditsStep,
  )
}

export function normalizeRechargeMonths(
  value: number,
  credits: number,
  config: RechargeStepConfig,
): number {
  if (config.testPriceEnabled && credits === TEST_RECHARGE_CREDITS) return TEST_RECHARGE_MONTHS
  return Math.min(config.maxMonths, Math.max(config.minMonths, value))
}

export function normalizeRechargeSelection(
  credits: number,
  months: number,
  config: RechargeStepConfig,
): { credits: number; months: number } {
  const normalizedCredits = normalizeRechargeCredits(credits, config)
  return {
    credits: normalizedCredits,
    months: normalizeRechargeMonths(months, normalizedCredits, config),
  }
}
