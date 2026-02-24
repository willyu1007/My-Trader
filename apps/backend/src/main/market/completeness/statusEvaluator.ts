import type { CompletenessStatus } from "@mytrader/shared";

export interface EvaluateCompletenessStatusInput {
  applicable: boolean;
  enabled: boolean;
  hasStarted: boolean;
  requiredTotal: number;
  requiredPresent: number;
  optionalTotal: number;
  optionalPresent: number;
}

export interface EvaluateCompletenessStatusResult {
  status: CompletenessStatus;
  coverageRatio: number | null;
}

export function evaluateCompletenessStatus(
  input: EvaluateCompletenessStatusInput
): EvaluateCompletenessStatusResult {
  if (!input.applicable) {
    return { status: "not_applicable", coverageRatio: null };
  }

  if (!input.enabled) {
    return { status: "not_applicable", coverageRatio: null };
  }

  const requiredTotal = normalizeCount(input.requiredTotal);
  const requiredPresent = Math.min(requiredTotal, normalizeCount(input.requiredPresent));
  const optionalTotal = normalizeCount(input.optionalTotal);
  const optionalPresent = Math.min(optionalTotal, normalizeCount(input.optionalPresent));

  const coverageRatio =
    requiredTotal > 0 ? roundRatio(requiredPresent / requiredTotal) : null;

  if (!input.hasStarted) {
    return { status: "not_started", coverageRatio };
  }

  if (requiredTotal === 0) {
    if (optionalTotal === 0) {
      return { status: "complete", coverageRatio: null };
    }
    return {
      status: optionalPresent > 0 ? "complete" : "not_started",
      coverageRatio: null
    };
  }

  if (requiredPresent >= requiredTotal) {
    return { status: "complete", coverageRatio };
  }

  if (requiredPresent > 0) {
    return { status: "partial", coverageRatio };
  }

  return { status: "missing", coverageRatio: 0 };
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
