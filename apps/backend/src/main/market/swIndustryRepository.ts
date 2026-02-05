import { all, run, transaction } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";

export type SwIndustryLevel = "l1" | "l2";

export interface SwIndustryInput {
  level: SwIndustryLevel;
  code: string;
  name: string;
  parentCode?: string | null;
}

export interface SwIndustryRow {
  level: SwIndustryLevel;
  code: string;
  name: string;
  parentCode: string | null;
  updatedAt: number;
}

export async function upsertSwIndustries(
  db: SqliteDatabase,
  inputs: SwIndustryInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const now = Date.now();

  await transaction(db, async () => {
    for (const input of inputs) {
      const level = input.level;
      const code = input.code.trim();
      const name = input.name.trim();
      if (!code || !name) continue;
      const parentCode = input.parentCode ? input.parentCode.trim() : null;
      await run(
        db,
        `
          insert into sw_industries (level, code, name, parent_code, updated_at)
          values (?, ?, ?, ?, ?)
          on conflict(level, code) do update set
            name = excluded.name,
            parent_code = excluded.parent_code,
            updated_at = excluded.updated_at
        `,
        [level, code, name, parentCode, now]
      );
    }
  });
}

export async function listSwIndustries(
  db: SqliteDatabase,
  input?: { level?: SwIndustryLevel | null; parentCode?: string | null }
): Promise<SwIndustryRow[]> {
  const level = input?.level ?? null;
  const parentCode = input?.parentCode ?? null;

  const rows = await all<{
    level: string;
    code: string;
    name: string;
    parent_code: string | null;
    updated_at: number;
  }>(
    db,
    `
      select level, code, name, parent_code, updated_at
      from sw_industries
      where (? is null or level = ?)
        and (? is null or parent_code = ?)
      order by level asc, name asc
    `,
    [level, level, parentCode, parentCode]
  );

  return rows.map((row) => ({
    level: row.level as SwIndustryLevel,
    code: row.code,
    name: row.name,
    parentCode: row.parent_code ?? null,
    updatedAt: row.updated_at
  }));
}
