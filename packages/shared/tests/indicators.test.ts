import { describe, expect, it } from 'vitest';

import {
  buildIndicatorSnapshot,
  crossedAbove,
  crossedBelow,
  ema,
  macd,
  rsi,
  sma,
  volumeSpikeRatio,
} from '../src/market/indicators';

const ascending = Array.from({ length: 40 }, (_, index) => index + 1);

describe('technical indicators', () => {
  it('computes a simple moving average', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4);
    expect(sma([1, 2], 3)).toBeNull();
    expect(sma([1, 2, 3], 0)).toBeNull();
  });

  it('computes an exponential moving average seeded with the SMA', () => {
    expect(ema([1, 2, 3], 2)).toBeCloseTo(2.5);
    expect(ema([1], 2)).toBeNull();
  });

  it('returns RSI 100 for a monotonically rising series', () => {
    expect(rsi(ascending, 14)).toBeCloseTo(100);
  });

  it('returns RSI 50 for a flat series', () => {
    expect(rsi(Array.from({ length: 20 }, () => 42), 14)).toBeCloseTo(50);
  });

  it('returns null when there is not enough data for RSI', () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });

  it('computes RSI below 50 for a falling series', () => {
    const falling = Array.from({ length: 30 }, (_, index) => 100 - index);
    const value = rsi(falling, 14);
    expect(value).not.toBeNull();
    expect(value as number).toBeLessThan(50);
  });

  it('computes MACD with signal and histogram consistency', () => {
    const result = macd(ascending);
    expect(result).not.toBeNull();
    expect(result!.histogram).toBeCloseTo(result!.macd - result!.signal);
  });

  it('returns null for MACD without enough history', () => {
    expect(macd([1, 2, 3])).toBeNull();
  });

  it('computes the volume spike ratio against the prior 20 sessions', () => {
    const volumes = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    expect(volumeSpikeRatio(volumes, 10)).toBeNull();
    const twentyPlusOne = [...Array.from({ length: 20 }, () => 10), 40];
    expect(volumeSpikeRatio(twentyPlusOne, 20)).toBeCloseTo(4);
  });

  it('detects threshold crossings', () => {
    expect(crossedAbove(9, 10, 10)).toBe(true);
    expect(crossedAbove(10, 10, 10)).toBe(false);
    expect(crossedBelow(11, 10, 10)).toBe(true);
    expect(crossedBelow(10, 10, 10)).toBe(false);
  });

  it('builds a snapshot from closes and volumes', () => {
    const snapshot = buildIndicatorSnapshot({
      closes: ascending,
      volumes: Array.from({ length: 30 }, () => 1_000),
    });
    expect(snapshot.sma20).not.toBeNull();
    expect(snapshot.rsi14).toBeCloseTo(100);
    expect(snapshot.volumeAvg20).toBe(1_000);
  });
});
