import { safeStorage } from "electron";
import type { DataDomainId, MarketTokenMatrixStatus } from "@mytrader/shared";

import { config } from "../config";
import { get, run } from "./sqlite";
import type { SqliteDatabase } from "./sqlite";
import { listDataDomainIds } from "../market/dataSourceCatalog";

const LEGACY_TOKEN_KEY = "tushare_token_v1";
const MAIN_TOKEN_KEY = "market_token_main_v2";
const DOMAIN_TOKEN_PREFIX = "market_token_domain_";

type StoredTokenPayload = {
  encryptedBase64: string;
  updatedAt: number;
};

export type TushareTokenSource = "env" | "local" | "none";
export type DomainResolvedTokenSource =
  | "domain_override"
  | "main"
  | "env_fallback"
  | "none";

export async function getResolvedTushareToken(
  businessDb: SqliteDatabase
): Promise<{ token: string | null; source: TushareTokenSource }> {
  const main = await getResolvedMainToken(businessDb);
  if (main.token) {
    return { token: main.token, source: main.source === "local" ? "local" : "env" };
  }
  return { token: null, source: "none" };
}

export async function setTushareToken(
  businessDb: SqliteDatabase,
  token: string | null
): Promise<void> {
  await setMainToken(businessDb, token);
}

export async function setMainToken(
  businessDb: SqliteDatabase,
  token: string | null
): Promise<void> {
  await writeEncryptedToken(businessDb, MAIN_TOKEN_KEY, token);
}

export async function setDomainToken(
  businessDb: SqliteDatabase,
  domainId: DataDomainId,
  token: string | null
): Promise<void> {
  await writeEncryptedToken(businessDb, buildDomainTokenKey(domainId), token);
}

export async function clearDomainToken(
  businessDb: SqliteDatabase,
  domainId: DataDomainId
): Promise<void> {
  await run(
    businessDb,
    `delete from market_settings where key = ?`,
    [buildDomainTokenKey(domainId)]
  );
}

export async function getResolvedTokenForDomain(
  businessDb: SqliteDatabase,
  domainId: DataDomainId
): Promise<{ token: string | null; source: DomainResolvedTokenSource }> {
  const domainToken = await readEncryptedToken(
    businessDb,
    buildDomainTokenKey(domainId)
  );
  if (domainToken) {
    return { token: domainToken, source: "domain_override" };
  }

  const main = await getResolvedMainToken(businessDb);
  if (main.token) {
    return {
      token: main.token,
      source: main.source === "local" ? "main" : "env_fallback"
    };
  }

  return { token: null, source: "none" };
}

export async function getMarketTokenMatrixStatus(
  businessDb: SqliteDatabase
): Promise<MarketTokenMatrixStatus> {
  const main = await getResolvedMainToken(businessDb);
  const domains = {} as MarketTokenMatrixStatus["domains"];
  for (const domainId of listDataDomainIds()) {
    const resolved = await getResolvedTokenForDomain(businessDb, domainId);
    domains[domainId] = {
      source: resolved.source,
      configured: Boolean(resolved.token)
    };
  }
  return {
    mainConfigured: Boolean(main.token) && main.source === "local",
    domains
  };
}

async function getResolvedMainToken(
  businessDb: SqliteDatabase
): Promise<{ token: string | null; source: "local" | "env_fallback" | "none" }> {
  const localToken = await readEncryptedToken(businessDb, MAIN_TOKEN_KEY);
  if (localToken) return { token: localToken, source: "local" };

  const legacyToken = await readEncryptedToken(businessDb, LEGACY_TOKEN_KEY);
  if (legacyToken) {
    await writeEncryptedToken(businessDb, MAIN_TOKEN_KEY, legacyToken);
    return { token: legacyToken, source: "local" };
  }

  const envToken = config.tushareToken?.trim() ?? "";
  if (envToken) return { token: envToken, source: "env_fallback" };

  return { token: null, source: "none" };
}

async function readEncryptedToken(
  businessDb: SqliteDatabase,
  key: string
): Promise<string | null> {
  const stored = await get<{ value_json: string }>(
    businessDb,
    `select value_json from market_settings where key = ?`,
    [key]
  );
  if (!stored?.value_json) return null;
  const payload = safeParseTokenPayload(stored.value_json);
  if (!payload) return null;

  try {
    const decrypted = safeStorage.decryptString(
      Buffer.from(payload.encryptedBase64, "base64")
    );
    const token = decrypted.trim();
    return token || null;
  } catch {
    return null;
  }
}

async function writeEncryptedToken(
  businessDb: SqliteDatabase,
  key: string,
  token: string | null
): Promise<void> {
  const value = token?.trim() ?? "";
  if (!value) {
    await run(businessDb, `delete from market_settings where key = ?`, [key]);
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
    [key, JSON.stringify(payload)]
  );
}

function buildDomainTokenKey(domainId: DataDomainId): string {
  return `${DOMAIN_TOKEN_PREFIX}${domainId}_v2`;
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
