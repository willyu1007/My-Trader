import type {
  CreateManualTagInput,
  DeleteManualTagsInput,
  DeleteManualTagsResult,
  ListManualTagsInput,
  ManualTagSummary,
  UpdateManualTagInput
} from "@mytrader/shared";

import { all, get, run, transaction } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const DEFAULT_MANUAL_TAG_COLOR = "#94A3B8";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const RESERVED_MANUAL_TAGS: Array<{
  tag: string;
  name: string;
  description: string;
  color: string;
}> = [
  {
    tag: "user:自选",
    name: "自选",
    description: "系统保留标签，用于核心自选观察。",
    color: "#64748B"
  },
  {
    tag: "user:重点关注",
    name: "重点关注",
    description: "系统保留标签，用于重点跟踪标的。",
    color: "#0EA5E9"
  }
];

function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeTagName(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("name 必须是字符串。");
  const value = raw.trim();
  if (!value) throw new Error("name 不能为空。");
  if (value.includes(":")) {
    throw new Error("name 不能包含 ':'，系统会自动添加 user: 前缀。");
  }
  return value;
}

function normalizeManualTag(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("tag 必须是字符串。");
  const value = raw.trim();
  if (!value) throw new Error("tag 不能为空。");
  if (!value.startsWith("user:")) {
    throw new Error("仅支持 user:* 手动标签。");
  }
  return value;
}

function normalizeDescription(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value ? value : null;
}

function normalizeColor(raw: unknown, fallback = DEFAULT_MANUAL_TAG_COLOR): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value) return fallback;
  if (!HEX_COLOR_RE.test(value)) {
    throw new Error("color 必须是 #RRGGBB 格式。");
  }
  return value.toUpperCase();
}

function isReservedTag(tag: string): boolean {
  return RESERVED_MANUAL_TAGS.some((item) => item.tag === tag);
}

async function ensureReservedManualTags(db: SqliteDatabase): Promise<void> {
  const now = Date.now();
  for (const item of RESERVED_MANUAL_TAGS) {
    await run(
      db,
      `
        insert into manual_tags (
          tag, name, description, color, is_reserved, created_at, updated_at
        )
        values (?, ?, ?, ?, 1, ?, ?)
        on conflict(tag) do update set
          name = excluded.name,
          description = excluded.description,
          color = excluded.color,
          is_reserved = 1,
          updated_at = excluded.updated_at
      `,
      [item.tag, item.name, item.description, item.color, now, now]
    );
  }
}

async function backfillManualTagsFromBindings(db: SqliteDatabase): Promise<void> {
  const now = Date.now();
  await run(
    db,
    `
      insert into manual_tags (
        tag, name, description, color, is_reserved, created_at, updated_at
      )
      select it.tag as tag,
             substr(it.tag, 6) as name,
             null as description,
             ? as color,
             0 as is_reserved,
             ? as created_at,
             ? as updated_at
      from instrument_tags it
      where it.tag like 'user:%'
        and not exists (
          select 1 from manual_tags mt where mt.tag = it.tag
        )
      group by it.tag
    `,
    [DEFAULT_MANUAL_TAG_COLOR, now, now]
  );
}

async function getManualTagSummaryByTag(
  db: SqliteDatabase,
  tag: string
): Promise<ManualTagSummary | null> {
  const row = await get<{
    tag: string;
    name: string;
    description: string | null;
    color: string;
    is_reserved: number;
    created_at: number;
    updated_at: number;
    member_count: number;
  }>(
    db,
    `
      select
        mt.tag,
        mt.name,
        mt.description,
        mt.color,
        mt.is_reserved,
        mt.created_at,
        mt.updated_at,
        count(distinct it.symbol) as member_count
      from manual_tags mt
      left join instrument_tags it
        on it.tag = mt.tag
      where mt.tag = ?
      group by
        mt.tag, mt.name, mt.description, mt.color, mt.is_reserved, mt.created_at, mt.updated_at
      limit 1
    `,
    [tag]
  );
  if (!row) return null;
  return {
    tag: row.tag,
    name: row.name,
    description: row.description ?? null,
    color: row.color,
    memberCount: row.member_count ?? 0,
    reserved: row.is_reserved === 1,
    editable: row.is_reserved !== 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listManualTags(
  db: SqliteDatabase,
  input?: ListManualTagsInput | null
): Promise<ManualTagSummary[]> {
  await ensureReservedManualTags(db);
  await backfillManualTagsFromBindings(db);

  const query = input?.query?.trim() ?? "";
  const safeLimit = Math.max(1, Math.min(500, Math.floor(input?.limit ?? 200)));
  const like = query ? `%${escapeLike(query)}%` : null;

  const rows = await all<{
    tag: string;
    name: string;
    description: string | null;
    color: string;
    is_reserved: number;
    created_at: number;
    updated_at: number;
    member_count: number;
  }>(
    db,
    query
      ? `
          select
            mt.tag,
            mt.name,
            mt.description,
            mt.color,
            mt.is_reserved,
            mt.created_at,
            mt.updated_at,
            count(distinct it.symbol) as member_count
          from manual_tags mt
          left join instrument_tags it
            on it.tag = mt.tag
          where mt.tag like ? escape '\\'
             or mt.name like ? escape '\\'
             or coalesce(mt.description, '') like ? escape '\\'
          group by
            mt.tag, mt.name, mt.description, mt.color, mt.is_reserved, mt.created_at, mt.updated_at
          order by mt.is_reserved desc, member_count desc, mt.tag asc
          limit ?
        `
      : `
          select
            mt.tag,
            mt.name,
            mt.description,
            mt.color,
            mt.is_reserved,
            mt.created_at,
            mt.updated_at,
            count(distinct it.symbol) as member_count
          from manual_tags mt
          left join instrument_tags it
            on it.tag = mt.tag
          group by
            mt.tag, mt.name, mt.description, mt.color, mt.is_reserved, mt.created_at, mt.updated_at
          order by mt.is_reserved desc, member_count desc, mt.tag asc
          limit ?
        `,
    query ? [like, like, like, safeLimit] : [safeLimit]
  );

  return rows.map((row) => ({
    tag: row.tag,
    name: row.name,
    description: row.description ?? null,
    color: row.color,
    memberCount: row.member_count ?? 0,
    reserved: row.is_reserved === 1,
    editable: row.is_reserved !== 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function createManualTag(
  db: SqliteDatabase,
  input: CreateManualTagInput
): Promise<ManualTagSummary> {
  await ensureReservedManualTags(db);
  const name = normalizeTagName(input?.name);
  const tag = `user:${name}`;
  if (isReservedTag(tag)) {
    throw new Error("系统保留标签不可新建。");
  }

  const existing = await get<{ tag: string }>(
    db,
    `select tag from manual_tags where tag = ? limit 1`,
    [tag]
  );
  if (existing) {
    throw new Error("手动标签已存在。");
  }

  const description = normalizeDescription(input?.description);
  const color = normalizeColor(input?.color);
  const now = Date.now();

  await run(
    db,
    `
      insert into manual_tags (
        tag, name, description, color, is_reserved, created_at, updated_at
      )
      values (?, ?, ?, ?, 0, ?, ?)
    `,
    [tag, name, description, color, now, now]
  );

  const created = await getManualTagSummaryByTag(db, tag);
  if (!created) throw new Error("手动标签创建失败。");
  return created;
}

export async function updateManualTag(
  db: SqliteDatabase,
  input: UpdateManualTagInput
): Promise<ManualTagSummary> {
  await ensureReservedManualTags(db);
  const tag = normalizeManualTag(input?.tag);
  const existing = await get<{
    tag: string;
    is_reserved: number;
    description: string | null;
    color: string;
  }>(
    db,
    `
      select tag, is_reserved, description, color
      from manual_tags
      where tag = ?
      limit 1
    `,
    [tag]
  );
  if (!existing) {
    throw new Error("手动标签不存在。");
  }
  if (existing.is_reserved === 1) {
    throw new Error("系统保留标签不允许编辑。");
  }

  const nextDescription =
    input.description === undefined
      ? existing.description
      : normalizeDescription(input.description);
  const nextColor =
    input.color === undefined ? existing.color : normalizeColor(input.color);
  const now = Date.now();

  await run(
    db,
    `
      update manual_tags
      set description = ?,
          color = ?,
          updated_at = ?
      where tag = ?
    `,
    [nextDescription, nextColor, now, tag]
  );

  const updated = await getManualTagSummaryByTag(db, tag);
  if (!updated) throw new Error("手动标签更新失败。");
  return updated;
}

export async function deleteManualTags(
  db: SqliteDatabase,
  input: DeleteManualTagsInput
): Promise<DeleteManualTagsResult> {
  await ensureReservedManualTags(db);
  const uniqueTags = Array.from(
    new Set((input?.tags ?? []).map((item) => normalizeManualTag(item)))
  );
  if (uniqueTags.length === 0) {
    return { deletedTags: 0, removedBindings: 0, skippedTags: [] };
  }

  const placeholders = uniqueTags.map(() => "?").join(", ");
  const manualRows = await all<{ tag: string; is_reserved: number }>(
    db,
    `
      select tag, is_reserved
      from manual_tags
      where tag in (${placeholders})
    `,
    uniqueTags
  );
  const reservedSet = new Set(
    manualRows.filter((row) => row.is_reserved === 1).map((row) => row.tag)
  );
  const deletableTags = uniqueTags.filter((tag) => !reservedSet.has(tag));
  const skippedTags = uniqueTags.filter((tag) => reservedSet.has(tag));
  if (deletableTags.length === 0) {
    return { deletedTags: 0, removedBindings: 0, skippedTags };
  }

  const deletablePlaceholders = deletableTags.map(() => "?").join(", ");
  const bindingRows = await all<{ tag: string; binding_count: number }>(
    db,
    `
      select tag, count(*) as binding_count
      from instrument_tags
      where tag in (${deletablePlaceholders})
      group by tag
    `,
    deletableTags
  );
  const bindingCountByTag = new Map(
    bindingRows.map((row) => [row.tag, row.binding_count ?? 0])
  );
  const existingManualSet = new Set(
    manualRows.filter((row) => row.is_reserved !== 1).map((row) => row.tag)
  );

  await transaction(db, async () => {
    await run(
      db,
      `delete from instrument_tags where tag in (${deletablePlaceholders})`,
      deletableTags
    );
    await run(
      db,
      `delete from manual_tags where tag in (${deletablePlaceholders})`,
      deletableTags
    );
  });

  const deletedTags = deletableTags.filter(
    (tag) => existingManualSet.has(tag) || (bindingCountByTag.get(tag) ?? 0) > 0
  ).length;
  const removedBindings = Array.from(bindingCountByTag.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  return { deletedTags, removedBindings, skippedTags };
}

