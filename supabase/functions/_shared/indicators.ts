/**
 * Compact indicator implementations for the edge runtime.
 *
 * The canonical, unit-tested implementation lives in
 * `packages/shared/src/market/indicators.ts`. Edge Functions are bundled and
 * deployed independently, so this file mirrors that logic; keep them in sync.
 */

export function sma(values: readonly number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  let sum = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    sum += values[index] as number;
  }
  return sum / period;
}

export function emaSeries(values: readonly number[], period: number): number[] {
  if (period <= 0 || values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const output: number[] = [seed];
  for (let index = period; index < values.length; index += 1) {
    const previous = output[output.length - 1] as number;
    output.push(((values[index] as number) - previous) * multiplier + previous);
  }
  return output;
}

export function rsi(values: readonly number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gainSum = 0;
  let lossSum = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = (values[index] as number) - (values[index - 1] as number);
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const change = (values[index] as number) - (values[index - 1] as number);
    averageGain = (averageGain * (period - 1) + (change > 0 ? change : 0)) / period;
    averageLoss = (averageLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
  }
  if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + averageGain / averageLoss);
}

export function macd(
  values: readonly number[],
): { macd: number; signal: number; histogram: number } | null {
  if (values.length < 34) return null;
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  const length = Math.min(fast.length, slow.length);
  if (length === 0) return null;
  const line: number[] = [];
  for (let index = 1; index <= length; index += 1) {
    line.push((fast[fast.length - index] as number) - (slow[slow.length - index] as number));
  }
  line.reverse();
  const signalSeries = emaSeries(line, 9);
  if (signalSeries.length === 0) return null;
  const value = line[line.length - 1] as number;
  const signal = signalSeries[signalSeries.length - 1] as number;
  return { macd: value, signal, histogram: value - signal };
}

export function volumeSpikeRatio(volumes: readonly number[], period = 20): number | null {
  if (volumes.length < period + 1) return null;
  const latest = volumes[volumes.length - 1] as number;
  const preceding = volumes.slice(volumes.length - period - 1, volumes.length - 1);
  const average = preceding.reduce((sum, volume) => sum + volume, 0) / period;
  return average > 0 ? latest / average : null;
}

export interface IndicatorSnapshot {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  volumeAvg20: number | null;
}

export function buildIndicatorSnapshot(input: {
  closes: readonly number[];
  volumes?: readonly number[];
}): IndicatorSnapshot {
  const macdResult = macd(input.closes);
  const volumes = input.volumes ?? [];
  return {
    sma20: sma(input.closes, 20),
    sma50: sma(input.closes, 50),
    sma200: sma(input.closes, 200),
    rsi14: rsi(input.closes, 14),
    macd: macdResult?.macd ?? null,
    macdSignal: macdResult?.signal ?? null,
    volumeAvg20: volumes.length >= 20 ? sma(volumes, 20) : null,
  };
}
