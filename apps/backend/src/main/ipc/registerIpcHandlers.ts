import { BrowserWindow, app, dialog, ipcMain } from "electron";
import type { OpenDialogOptions } from "electron";
import fs from "node:fs";
import path from "node:path";

import { IPC_CHANNELS } from "@mytrader/shared";

import type {
  AccountSummary,
  CreateAccountInput,
  CreatePortfolioInput,
  CreatePositionInput,
  CreateRiskLimitInput,
  ImportHoldingsCsvInput,
  ImportPricesCsvInput,
  TushareIngestInput,
  UpdatePortfolioInput,
  UpdatePositionInput,
  UpdateRiskLimitInput,
  UnlockAccountInput
} from "@mytrader/shared";
import { ensureBusinessSchema } from "../storage/businessSchema";
import { AccountIndexDb } from "../storage/accountIndexDb";
import { ensureMarketCacheSchema } from "../market/marketCache";
import {
  createPortfolio,
  deletePortfolio,
  listPortfolios,
  updatePortfolio
} from "../storage/portfolioRepository";
import {
  createPosition,
  deletePosition,
  updatePosition
} from "../storage/positionRepository";
import {
  createRiskLimit,
  deleteRiskLimit,
  updateRiskLimit
} from "../storage/riskLimitRepository";
import { ensureAccountDataLayout } from "../storage/paths";
import { close, exec, openSqliteDatabase } from "../storage/sqlite";
import type { SqliteDatabase } from "../storage/sqlite";
import { getPortfolioSnapshot } from "../services/portfolioService";
import {
  importHoldingsCsv,
  importPricesCsv,
  ingestTushare
} from "../services/marketService";

let accountIndexDb: AccountIndexDb | null = null;
let activeAccount: AccountSummary | null = null;
let activeBusinessDb: SqliteDatabase | null = null;
let marketCacheDb: SqliteDatabase | null = null;

function requireActiveBusinessDb(): SqliteDatabase {
  if (!activeBusinessDb) throw new Error("当前账号未解锁。");
  return activeBusinessDb;
}

function requireMarketCacheDb(): SqliteDatabase {
  if (!marketCacheDb) throw new Error("行情缓存未初始化。");
  return marketCacheDb;
}

export async function registerIpcHandlers() {
  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });

  const accountIndexPath = path.join(userDataDir, "account-index.sqlite");
  accountIndexDb = await AccountIndexDb.open(accountIndexPath);

  const marketCachePath = path.join(userDataDir, "market-cache.sqlite");
  marketCacheDb = await openSqliteDatabase(marketCachePath);
  await exec(marketCacheDb, `pragma journal_mode = wal;`);
  await ensureMarketCacheSchema(marketCacheDb);

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_GET_ACTIVE, async () => activeAccount);

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_LIST, async () => {
    if (!accountIndexDb) throw new Error("账号索引库尚未初始化。");
    return await accountIndexDb.listAccounts();
  });

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_CHOOSE_DATA_ROOT_DIR,
    async (event) => {
      const isDev = Boolean(process.env.MYTRADER_DEV_SERVER_URL);
      if (isDev) console.log("[mytrader] 打开系统目录选择器");

      const ownerWindow =
        BrowserWindow.fromWebContents(event.sender) ??
        BrowserWindow.getFocusedWindow() ??
        BrowserWindow.getAllWindows()[0] ??
        null;

      if (ownerWindow) {
        if (ownerWindow.isMinimized()) ownerWindow.restore();
        ownerWindow.show();
        ownerWindow.focus();
        ownerWindow.moveTop();
      }

      if (process.platform === "darwin") {
        app.focus({ steal: true });
      }

      const options: OpenDialogOptions = {
        title: "选择数据目录",
        buttonLabel: "选择",
        properties: ["openDirectory", "createDirectory"]
      };
      const result =
        process.platform === "darwin"
          ? await dialog.showOpenDialog(options)
          : ownerWindow
            ? await dialog.showOpenDialog(ownerWindow, options)
            : await dialog.showOpenDialog(options);
      if (result.canceled) return null;
      const selected = result.filePaths[0] ?? null;
      if (isDev) console.log("[mytrader] 目录选择结果：", selected ?? "(取消)");
      return selected;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_CREATE,
    async (_event, input: CreateAccountInput) => {
      if (!accountIndexDb) throw new Error("账号索引库尚未初始化。");

      const label = input.label.trim();
      if (!label) throw new Error("账号名称不能为空。");
      if (!input.password) throw new Error("密码不能为空。");

      const userData = app.getPath("userData");
      const defaultRoot = path.join(userData, "accounts");

      const dataRootDir = input.dataRootDir?.trim()
        ? input.dataRootDir.trim()
        : defaultRoot;

      if (!path.isAbsolute(dataRootDir)) {
        throw new Error("数据根目录必须是绝对路径。");
      }

      const created = await accountIndexDb.createAccount({
        label,
        password: input.password,
        dataRootDir
      });

      await ensureAccountDataLayout(created.dataDir);
      return created;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ACCOUNT_UNLOCK,
    async (_event, input: UnlockAccountInput) => {
      if (!accountIndexDb) throw new Error("账号索引库尚未初始化。");
      if (!input.accountId) throw new Error("账号 ID 不能为空。");
      if (!input.password) throw new Error("密码不能为空。");

      const unlocked = await accountIndexDb.unlockAccount({
        accountId: input.accountId,
        password: input.password
      });

      const layout = await ensureAccountDataLayout(unlocked.dataDir);

      if (activeBusinessDb) {
        await close(activeBusinessDb);
        activeBusinessDb = null;
      }

      activeBusinessDb = await openSqliteDatabase(layout.businessDbPath);
      await exec(activeBusinessDb, `pragma journal_mode = wal;`);
      await ensureBusinessSchema(activeBusinessDb);

      activeAccount = unlocked;
      return unlocked;
    }
  );

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_LOCK, async () => {
    if (activeBusinessDb) {
      await close(activeBusinessDb);
      activeBusinessDb = null;
    }
    activeAccount = null;
  });

  ipcMain.handle(IPC_CHANNELS.PORTFOLIO_LIST, async () => {
    const db = requireActiveBusinessDb();
    return await listPortfolios(db);
  });

  ipcMain.handle(
    IPC_CHANNELS.PORTFOLIO_CREATE,
    async (_event, input: CreatePortfolioInput) => {
      const db = requireActiveBusinessDb();
      const name = input.name.trim();
      if (!name) throw new Error("组合名称不能为空。");
      const baseCurrency = input.baseCurrency?.trim() || "CNY";
      return await createPortfolio(db, { name, baseCurrency });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PORTFOLIO_UPDATE,
    async (_event, input: UpdatePortfolioInput) => {
      const db = requireActiveBusinessDb();
      const name = input.name.trim();
      if (!name) throw new Error("组合名称不能为空。");
      const baseCurrency = input.baseCurrency?.trim() || "CNY";
      return await updatePortfolio(db, { id: input.id, name, baseCurrency });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PORTFOLIO_REMOVE,
    async (_event, portfolioId: string) => {
      const db = requireActiveBusinessDb();
      await deletePortfolio(db, portfolioId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PORTFOLIO_GET_SNAPSHOT,
    async (_event, portfolioId: string) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      return await getPortfolioSnapshot(businessDb, marketDb, portfolioId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.POSITION_CREATE,
    async (_event, input: CreatePositionInput) => {
      const db = requireActiveBusinessDb();
      const symbol = input.symbol.trim();
      const market = input.market.trim();
      const currency = input.currency.trim();
      if (!symbol) throw new Error("持仓代码不能为空。");
      if (!market) throw new Error("持仓市场不能为空。");
      if (!currency) throw new Error("持仓币种不能为空。");
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw new Error("持仓数量必须大于 0。");
      }
      return await createPosition(db, {
        ...input,
        symbol,
        market,
        currency,
        name: input.name?.trim() || null,
        cost: Number.isFinite(input.cost ?? NaN) ? input.cost ?? null : null,
        openDate: input.openDate?.trim() || null
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.POSITION_UPDATE,
    async (_event, input: UpdatePositionInput) => {
      const db = requireActiveBusinessDb();
      const symbol = input.symbol.trim();
      const market = input.market.trim();
      const currency = input.currency.trim();
      if (!symbol) throw new Error("持仓代码不能为空。");
      if (!market) throw new Error("持仓市场不能为空。");
      if (!currency) throw new Error("持仓币种不能为空。");
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw new Error("持仓数量必须大于 0。");
      }
      return await updatePosition(db, input.id, {
        ...input,
        symbol,
        market,
        currency,
        name: input.name?.trim() || null,
        cost: Number.isFinite(input.cost ?? NaN) ? input.cost ?? null : null,
        openDate: input.openDate?.trim() || null
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.POSITION_REMOVE,
    async (_event, positionId: string) => {
      const db = requireActiveBusinessDb();
      await deletePosition(db, positionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.RISK_CREATE,
    async (_event, input: CreateRiskLimitInput) => {
      const db = requireActiveBusinessDb();
      if (!input.target.trim()) throw new Error("风险目标不能为空。");
      if (input.threshold <= 0 || input.threshold > 1) {
        throw new Error("风险阈值必须在 0 到 1 之间。");
      }
      return await createRiskLimit(db, {
        portfolioId: input.portfolioId,
        limitType: input.limitType,
        target: input.target.trim(),
        threshold: input.threshold
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.RISK_UPDATE,
    async (_event, input: UpdateRiskLimitInput) => {
      const db = requireActiveBusinessDb();
      if (!input.target.trim()) throw new Error("风险目标不能为空。");
      if (input.threshold <= 0 || input.threshold > 1) {
        throw new Error("风险阈值必须在 0 到 1 之间。");
      }
      return await updateRiskLimit(db, {
        id: input.id,
        portfolioId: input.portfolioId,
        limitType: input.limitType,
        target: input.target.trim(),
        threshold: input.threshold
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.RISK_REMOVE,
    async (_event, riskLimitId: string) => {
      const db = requireActiveBusinessDb();
      await deleteRiskLimit(db, riskLimitId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_CHOOSE_CSV_FILE,
    async (event, kind: "holdings" | "prices") => {
      const ownerWindow =
        BrowserWindow.fromWebContents(event.sender) ??
        BrowserWindow.getFocusedWindow() ??
        BrowserWindow.getAllWindows()[0] ??
        null;

      const options: OpenDialogOptions = {
        title: kind === "holdings" ? "选择持仓 CSV" : "选择行情 CSV",
        buttonLabel: "选择",
        properties: ["openFile"],
        filters: [{ name: "CSV", extensions: ["csv"] }]
      };

      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled) return null;
      return result.filePaths[0] ?? null;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_IMPORT_HOLDINGS_CSV,
    async (_event, input: ImportHoldingsCsvInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      if (!input.filePath) throw new Error("CSV 文件路径不能为空。");
      return await importHoldingsCsv(businessDb, marketDb, input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_IMPORT_PRICES_CSV,
    async (_event, input: ImportPricesCsvInput) => {
      const marketDb = requireMarketCacheDb();
      if (!input.filePath) throw new Error("CSV 文件路径不能为空。");
      return await importPricesCsv(marketDb, input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_INGEST_TUSHARE,
    async (_event, input: TushareIngestInput) => {
      const marketDb = requireMarketCacheDb();
      if (!input.items.length) {
        throw new Error("至少需要一个代码才能拉取。");
      }
      return await ingestTushare(marketDb, input);
    }
  );
}
