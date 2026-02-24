import crypto from "node:crypto";
import path from "node:path";

import type { AccountSummary } from "@mytrader/shared";

import { hashPassword, verifyPassword } from "./password";
import {
  all,
  close,
  exec,
  execVolatile,
  get,
  openSqliteDatabase,
  run
} from "./sqlite";
import type { SqliteDatabase } from "./sqlite";

interface CreateAccountArgs {
  label: string;
  password: string;
  dataRootDir: string;
}

interface UnlockAccountArgs {
  accountId: string;
  password: string;
}

interface DbAccountRow {
  id: string;
  label: string;
  password_hash: string;
  data_dir: string;
  created_at: number;
  last_login_at: number | null;
}

export class AccountIndexDb {
  private db: SqliteDatabase;

  private constructor(db: SqliteDatabase) {
    this.db = db;
  }

  static async open(dbPath: string): Promise<AccountIndexDb> {
    const db = await openSqliteDatabase(dbPath);
    await execVolatile(db, `pragma journal_mode = delete;`);
    await execVolatile(db, `pragma temp_store = memory;`);
    await exec(
      db,
      `
        create table if not exists accounts (
          id text primary key not null,
          label text not null unique,
          password_hash text not null,
          data_dir text not null,
          created_at integer not null,
          last_login_at integer
        );
      `
    );
    return new AccountIndexDb(db);
  }

  async close() {
    await close(this.db);
  }

  async listAccounts(): Promise<AccountSummary[]> {
    const rows = await all<
      Pick<
        DbAccountRow,
        "id" | "label" | "data_dir" | "created_at" | "last_login_at"
      >
    >(
      this.db,
      `select id, label, data_dir, created_at, last_login_at from accounts order by created_at asc`
    );

    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      dataDir: r.data_dir,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at
    }));
  }

  async createAccount(args: CreateAccountArgs): Promise<AccountSummary> {
    const now = Date.now();
    const id = crypto.randomUUID();
    const accountDirName = `mytrader-account-${id}`;
    const dataDir = path.join(args.dataRootDir, accountDirName);

    const passwordHash = hashPassword(args.password);

    try {
      await run(
        this.db,
        `
          insert into accounts (id, label, password_hash, data_dir, created_at, last_login_at)
          values (?, ?, ?, ?, ?, ?)
        `,
        [id, args.label, passwordHash, dataDir, now, null]
      );
    } catch (e) {
      if (isSqliteConstraintError(e)) {
        throw new Error(`账号名称已存在：${args.label}`);
      }
      throw e;
    }

    return {
      id,
      label: args.label,
      dataDir,
      createdAt: now,
      lastLoginAt: null
    };
  }

  async unlockAccount(args: UnlockAccountArgs): Promise<AccountSummary> {
    const row = await get<DbAccountRow>(
      this.db,
      `select id, label, password_hash, data_dir, created_at, last_login_at from accounts where id = ?`,
      [args.accountId]
    );

    if (!row) throw new Error("未找到该账号。");
    if (!verifyPassword(args.password, row.password_hash)) {
      throw new Error("密码错误。");
    }

    const now = Date.now();
    await run(
      this.db,
      `update accounts set last_login_at = ? where id = ?`,
      [now, row.id]
    );

    return {
      id: row.id,
      label: row.label,
      dataDir: row.data_dir,
      createdAt: row.created_at,
      lastLoginAt: now
    };
  }

  async unlockAccountDev(accountId: string): Promise<AccountSummary> {
    const row = await get<DbAccountRow>(
      this.db,
      `select id, label, data_dir, created_at, last_login_at from accounts where id = ?`,
      [accountId]
    );

    if (!row) throw new Error("未找到该账号。");

    const now = Date.now();
    await run(
      this.db,
      `update accounts set last_login_at = ? where id = ?`,
      [now, row.id]
    );

    return {
      id: row.id,
      label: row.label,
      dataDir: row.data_dir,
      createdAt: row.created_at,
      lastLoginAt: now
    };
  }
}

function isSqliteConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (!("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "SQLITE_CONSTRAINT";
}
