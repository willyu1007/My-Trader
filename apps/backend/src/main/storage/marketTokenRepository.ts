import { safeStorage } from "electron";

import { config } from "../config";
import { get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

const TOKEN_KEY = "tushare_token_v1";

type StoredTokenPayload = {
  encryptedBase64: string;
  updatedAt: number;
};

export type TushareTokenSource = "env" | "local" | "none";

export async function getResolvedTushareToken(
  businessDb: SqliteDatabase
): Promise<{ token: string | null; source: TushareTokenSource }> {
  const envToken = config.tushareToken?.trim() ?? "";
  if (envToken) return { token: envToken, source: "env" };

  const stored = await get<{ value_json: string }>(
    businessDb,
    `select value_json from market_settings where key = ?`,
    [TOKEN_KEY]
  );
  if (!stored?.value_json) return { token: null, source: "none" };
  const payload = safeParseTokenPayload(stored.value_json);
  if (!payload) return { token: null, source: "none" };

  try {
    const decrypted = safeStorage.decryptString(
      Buffer.from(payload.encryptedBase64, "base64")
    );
    const token = decrypted.trim();
    return { token: token ? token : null, source: token ? "local" : "none" };
  } catch {
    return { token: null, source: "none" };
  }
}

export async function setTushareToken(
  businessDb: SqliteDatabase,
  token: string | null
): Promise<void> {
  const value = token?.trim() ?? "";
  if (!value) {
    await run(businessDb, `delete from market_settings where key = ?`, [TOKEN_KEY]);
    return;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("当前系统不支持安全存储（safeStorage）。");
  }

  const encrypted = safeStorage.encryptString(value);
  const payload: StoredTokenPayload = {
    encryptedBase64: Buffer.from(encrypted).toString("base64"),
    updatedAt: Date.now()
  };

  await run(
    businessDb,
    `
      insert into market_settings (key, value_json)
      values (?, ?)
      on conflict(key) do update set value_json = excluded.value_json
    `,
    [TOKEN_KEY, JSON.stringify(payload)]
  );
}

function safeParseTokenPayload(value: string): StoredTokenPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredTokenPayload>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.encryptedBase64 !== "string" || !parsed.encryptedBase64) {
      return null;
    }
    if (typeof parsed.updatedAt !== "number" || !Number.isFinite(parsed.updatedAt)) {
      return null;
    }
    return {
      encryptedBase64: parsed.encryptedBase64,
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
}
