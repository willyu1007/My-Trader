import { run } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export type IngestStepStage = "extract" | "normalize" | "upsert" | "evaluate";

export type IngestStepStatus = "running" | "success" | "failed" | "skipped";

export interface UpsertIngestStepRunInput {
  ingestRunId: string;
  stepId: string;
  scopeId: "targets" | "universe";
  domainId: string | null;
  moduleId: string | null;
  stage: IngestStepStage;
  status: IngestStepStatus;
  inputRows: number | null;
  outputRows: number | null;
  droppedRows: number | null;
  errorMessage: string | null;
  startedAt: number;
  finishedAt: number | null;
}

export async function upsertIngestStepRun(
  db: SqliteDatabase,
  input: UpsertIngestStepRunInput
): Promise<void> {
  await run(
    db,
    `
      insert into ingest_step_runs_v1 (
        ingest_run_id,
        step_id,
        scope_id,
        domain_id,
        module_id,
        stage,
        status,
        input_rows,
        output_rows,
        dropped_rows,
        error_message,
        started_at,
        finished_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(ingest_run_id, step_id) do update set
        scope_id = excluded.scope_id,
        domain_id = excluded.domain_id,
        module_id = excluded.module_id,
        stage = excluded.stage,
        status = excluded.status,
        input_rows = excluded.input_rows,
        output_rows = excluded.output_rows,
        dropped_rows = excluded.dropped_rows,
        error_message = excluded.error_message,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at
    `,
    [
      input.ingestRunId,
      input.stepId,
      input.scopeId,
      input.domainId,
      input.moduleId,
      input.stage,
      input.status,
      normalizeCount(input.inputRows),
      normalizeCount(input.outputRows),
      normalizeCount(input.droppedRows),
      input.errorMessage,
      normalizeEpoch(input.startedAt),
      input.finishedAt === null ? null : normalizeEpoch(input.finishedAt)
    ]
  );
}

function normalizeCount(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function normalizeEpoch(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return Date.now();
  return Math.floor(value);
}
