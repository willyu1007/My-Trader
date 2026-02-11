import { BrowserWindow, app, dialog, ipcMain, shell } from "electron";
import type { OpenDialogOptions } from "electron";
import fs from "node:fs";
import path from "node:path";

import { IPC_CHANNELS } from "@mytrader/shared";

import type {
  AccountSummary,
  BatchSetInstrumentAutoIngestInput,
  ClearMarketDomainTokenInput,
  CorporateActionCategory,
  CorporateActionMeta,
  CreateAccountInput,
  GetDailyBarsInput,
  GetIngestRunDetailInput,
  GetQuotesInput,
  GetTagMembersInput,
  GetTagSeriesInput,
  ListInstrumentRegistryInput,
  CreateLedgerEntryInput,
  CreatePortfolioInput,
  CreatePositionInput,
  CreateRiskLimitInput,
  ImportHoldingsCsvInput,
  ImportPricesCsvInput,
  ListTagsInput,
  MarketIngestSchedulerConfig,
  MarketTargetsConfig,
  MarketUniversePoolConfig,
  PreviewTargetsDraftInput,
  PortfolioPerformanceRangeInput,
  SearchInstrumentsInput,
  SetMarketDomainTokenInput,
  SetMarketMainTokenInput,
  SetInstrumentAutoIngestInput,
  TestMarketDomainConnectivityInput,
  TestMarketModuleConnectivityInput,
  TushareIngestInput,
  UpsertWatchlistItemInput,
  UpdateLedgerEntryInput,
  UpdatePortfolioInput,
  UpdatePositionInput,
  UpdateRiskLimitInput,
  UnlockAccountInput,
  ValidateDataSourceReadinessInput
} from "@mytrader/shared";
import { ensureBusinessSchema } from "../storage/businessSchema";
import { AccountIndexDb } from "../storage/accountIndexDb";
import { ensureMarketCacheSchema } from "../market/marketCache";
import {
  batchSetInstrumentAutoIngest,
  getLatestPrices,
  listInstrumentRegistry,
  setInstrumentAutoIngest,
  upsertInstruments
} from "../market/marketRepository";
import {
  startAutoIngest,
  stopAutoIngest,
  triggerAutoIngest
} from "../market/autoIngest";
import {
  startMarketIngestScheduler,
  stopMarketIngestScheduler
} from "../market/marketIngestScheduler";
import {
  createPortfolio,
  deletePortfolio,
  getPortfolio,
  listPortfolios,
  updatePortfolio
} from "../storage/portfolioRepository";
import {
  createLedgerEntry,
  listLedgerEntriesByPortfolio,
  softDeleteLedgerEntry,
  updateLedgerEntry
} from "../storage/ledgerRepository";
import {
  getBaselineExternalIdForPosition,
  softDeleteBaselineLedgerForPosition,
  upsertBaselineLedgerFromPosition
} from "../storage/ledgerBaseline";
import {
  createPosition,
  deletePosition,
  getPositionById,
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
import {
  clearDomainToken,
  getMarketTokenMatrixStatus,
  getResolvedTushareToken,
  setDomainToken,
  setMainToken,
  setTushareToken
} from "../storage/marketTokenRepository";
import { getPortfolioSnapshot } from "../services/portfolioService";
import { buildPortfolioPerformanceRange } from "../services/performanceService";
import {
  importHoldingsCsv,
  importPricesCsv,
  ingestTushare,
  syncTushareInstrumentCatalog,
  searchInstrumentCatalog,
  getInstrumentCatalogProfile,
  getMarketDailyBars,
  getMarketQuotes,
  getMarketTagMembers,
  getMarketTagSeries,
  seedMarketDemoData,
  listMarketTags
} from "../services/marketService";
import { config } from "../config";
import {
  getMarketTargetsConfig,
  getMarketIngestSchedulerConfig,
  getMarketUniversePoolOverview,
  listTempTargetSymbols,
  removeTempTargetSymbol,
  setMarketIngestSchedulerConfig,
  setMarketTargetsConfig,
  touchTempTargetSymbol
} from "../storage/marketSettingsRepository";
import {
  addInstrumentTag,
  listInstrumentTags,
  removeInstrumentTag
} from "../storage/instrumentTagRepository";
import {
  listWatchlistItems,
  removeWatchlistItem,
  upsertWatchlistItem
} from "../storage/watchlistRepository";
import { previewTargets, previewTargetsDraft } from "../market/targetsService";
import { getIngestRunById, listIngestRuns } from "../market/ingestRunsRepository";
import { getMarketProvider } from "../market/providers";
import { validateDataSourceReadiness } from "../market/dataSourceReadinessService";
import {
  listConnectivityTests,
  testDomainConnectivity,
  testModuleConnectivity
} from "../market/connectivityTestService";
import {
  getMarketDataSourceCatalog,
  getMarketDataSourceConfig,
  getLegacyUniversePoolConfigFromDataSource,
  markConnectivityTestsStale,
  setLegacyUniversePoolConfigToDataSource,
  setMarketDataSourceConfig
} from "../storage/marketDataSourceRepository";
import {
  cancelManagedIngest,
  enqueueManagedIngest,
  getManagedIngestControlStatus,
  pauseManagedIngest,
  resumeManagedIngest,
  startIngestOrchestrator,
  stopIngestOrchestrator
} from "../market/ingestOrchestrator";

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
      const isDev = config.isDev;
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
      const allowDevBypass = config.isDev && input.devBypass === true;
      if (!allowDevBypass && !input.password) throw new Error("密码不能为空。");

      const unlocked = allowDevBypass
        ? await accountIndexDb.unlockAccountDev(input.accountId)
        : await accountIndexDb.unlockAccount({
            accountId: input.accountId,
            password: input.password ?? ""
          });

      const layout = await ensureAccountDataLayout(unlocked.dataDir);

      if (activeBusinessDb) {
        stopIngestOrchestrator();
        stopAutoIngest();
        stopMarketIngestScheduler();
        await close(activeBusinessDb);
        activeBusinessDb = null;
      }

      activeBusinessDb = await openSqliteDatabase(layout.businessDbPath);
      await exec(activeBusinessDb, `pragma journal_mode = wal;`);
      await ensureBusinessSchema(activeBusinessDb);

      activeAccount = unlocked;
      const marketDb = requireMarketCacheDb();
      await startIngestOrchestrator({
        businessDb: activeBusinessDb,
        marketDb,
        analysisDbPath: layout.analysisDbPath
      });
      startAutoIngest(activeBusinessDb, marketDb);
      startMarketIngestScheduler(activeBusinessDb, marketDb, layout.analysisDbPath);
      return unlocked;
    }
  );

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_LOCK, async () => {
    if (activeBusinessDb) {
      stopIngestOrchestrator();
      stopAutoIngest();
      stopMarketIngestScheduler();
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
    IPC_CHANNELS.PORTFOLIO_GET_PERFORMANCE,
    async (_event, input: PortfolioPerformanceRangeInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      const portfolioId = normalizeRequiredString(input.portfolioId, "portfolioId");
      const range = normalizePerformanceRange(input.range);
      const ledgerEntries = await listLedgerEntriesByPortfolio(
        businessDb,
        portfolioId
      );
      const symbols = Array.from(
        new Set(
          ledgerEntries
            .map((entry) => entry.symbol)
            .filter((symbol): symbol is string => Boolean(symbol))
        )
      );
      const latestPrices = await getLatestPrices(marketDb, symbols);
      const priceAsOf = Array.from(latestPrices.values())
        .map((price) => price.tradeDate)
        .filter(Boolean)
        .sort()
        .pop() ?? null;
      return await buildPortfolioPerformanceRange({
        ledgerEntries,
        marketDb,
        range,
        priceAsOf
      });
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
      const normalized = {
        ...input,
        symbol,
        market,
        currency,
        name: input.name?.trim() || null,
        cost: Number.isFinite(input.cost ?? NaN) ? input.cost ?? null : null,
        openDate: input.openDate?.trim() || null
      };
      const created = await createPosition(db, normalized);
      const marketDb = requireMarketCacheDb();
      await upsertInstruments(marketDb, [
        {
          symbol,
          name: normalized.name,
          assetClass: normalized.assetClass,
          market: normalized.market,
          currency: normalized.currency
        }
      ]);
      await upsertBaselineLedgerFromPosition(db, created);
      void triggerAutoIngest("positions");
      return created;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.POSITION_UPDATE,
    async (_event, input: UpdatePositionInput) => {
      const db = requireActiveBusinessDb();
      const existing = await getPositionById(db, input.id);
      const symbol = input.symbol.trim();
      const market = input.market.trim();
      const currency = input.currency.trim();
      if (!symbol) throw new Error("持仓代码不能为空。");
      if (!market) throw new Error("持仓市场不能为空。");
      if (!currency) throw new Error("持仓币种不能为空。");
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw new Error("持仓数量必须大于 0。");
      }
      const normalized = {
        ...input,
        symbol,
        market,
        currency,
        name: input.name?.trim() || null,
        cost: Number.isFinite(input.cost ?? NaN) ? input.cost ?? null : null,
        openDate: input.openDate?.trim() || null
      };
      const updated = await updatePosition(db, input.id, normalized);
      const marketDb = requireMarketCacheDb();
      await upsertInstruments(marketDb, [
        {
          symbol,
          name: normalized.name,
          assetClass: normalized.assetClass,
          market: normalized.market,
          currency: normalized.currency
        }
      ]);
      await upsertBaselineLedgerFromPosition(db, updated);
      if (existing) {
        const existingExternalId = getBaselineExternalIdForPosition(existing);
        const updatedExternalId = getBaselineExternalIdForPosition(updated);
        if (
          existing.portfolioId !== updated.portfolioId ||
          existingExternalId !== updatedExternalId
        ) {
          await softDeleteBaselineLedgerForPosition(db, existing);
        }
      }
      void triggerAutoIngest("positions");
      return updated;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.POSITION_REMOVE,
    async (_event, positionId: string) => {
      const db = requireActiveBusinessDb();
      const existing = await getPositionById(db, positionId);
      await deletePosition(db, positionId);
      if (existing) await softDeleteBaselineLedgerForPosition(db, existing);
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
    IPC_CHANNELS.LEDGER_LIST,
    async (_event, portfolioId: string) => {
      const db = requireActiveBusinessDb();
      return await listLedgerEntriesByPortfolio(db, portfolioId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LEDGER_CREATE,
    async (_event, input: CreateLedgerEntryInput) => {
      const db = requireActiveBusinessDb();
      const normalized = await normalizeLedgerEntryInput(db, input);
      return await createLedgerEntry(db, normalized);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LEDGER_UPDATE,
    async (_event, input: UpdateLedgerEntryInput) => {
      const db = requireActiveBusinessDb();
      const normalized = await normalizeLedgerEntryUpdateInput(db, input);
      return await updateLedgerEntry(db, normalized);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LEDGER_REMOVE,
    async (_event, ledgerEntryId: string) => {
      const db = requireActiveBusinessDb();
      await softDeleteLedgerEntry(db, ledgerEntryId);
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
      const result = await importHoldingsCsv(businessDb, marketDb, input);
      void triggerAutoIngest("import");
      return result;
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
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      if (!input.items.length) {
        throw new Error("至少需要一个代码才能拉取。");
      }
      const resolved = await getResolvedTushareToken(businessDb);
      return await ingestTushare(marketDb, input, resolved.token);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_SYNC_INSTRUMENT_CATALOG,
    async () => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      const resolved = await getResolvedTushareToken(businessDb);
      return await syncTushareInstrumentCatalog(marketDb, resolved.token);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_SEARCH_INSTRUMENTS,
    async (_event, input: SearchInstrumentsInput) => {
      const marketDb = requireMarketCacheDb();
      const query = input.query?.trim() ?? "";
      const limit = input.limit ?? 50;
      if (!query) return [];
      return await searchInstrumentCatalog(marketDb, query, limit ?? 50);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_GET_INSTRUMENT_PROFILE,
    async (_event, symbol: string) => {
      const marketDb = requireMarketCacheDb();
      const key = symbol?.trim() ?? "";
      if (!key) return null;
      return await getInstrumentCatalogProfile(marketDb, key);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_GET_TARGETS,
    async () => {
      const businessDb = requireActiveBusinessDb();
      return await getMarketTargetsConfig(businessDb);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_SET_TARGETS,
    async (_event, input: MarketTargetsConfig) => {
      const businessDb = requireActiveBusinessDb();
      await setMarketTargetsConfig(businessDb, input);
      void triggerAutoIngest("positions");
      return await getMarketTargetsConfig(businessDb);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_PREVIEW_TARGETS,
    async () => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      return await previewTargets({ businessDb, marketDb });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TARGETS_PREVIEW_DRAFT,
    async (_event, input: PreviewTargetsDraftInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("previewTargetsDraft input is required.");
      }
      return await previewTargetsDraft({
        businessDb,
        marketDb,
        draftInput: input
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_WATCHLIST_LIST,
    async () => {
      const businessDb = requireActiveBusinessDb();
      return await listWatchlistItems(businessDb);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_WATCHLIST_UPSERT,
    async (_event, input: UpsertWatchlistItemInput) => {
      const businessDb = requireActiveBusinessDb();
      const item = await upsertWatchlistItem(businessDb, input);
      void triggerAutoIngest("positions");
      return item;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_WATCHLIST_REMOVE,
    async (_event, symbol: string) => {
      const businessDb = requireActiveBusinessDb();
      await removeWatchlistItem(businessDb, symbol);
      void triggerAutoIngest("positions");
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TAGS_LIST,
    async (_event, symbol: string) => {
      const businessDb = requireActiveBusinessDb();
      return await listInstrumentTags(businessDb, symbol);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TAGS_ADD,
    async (_event, symbol: string, tag: string) => {
      const businessDb = requireActiveBusinessDb();
      await addInstrumentTag(businessDb, symbol, tag);
      void triggerAutoIngest("positions");
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TAGS_REMOVE,
    async (_event, symbol: string, tag: string) => {
      const businessDb = requireActiveBusinessDb();
      await removeInstrumentTag(businessDb, symbol, tag);
      void triggerAutoIngest("positions");
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_LIST_TAGS,
    async (_event, input: ListTagsInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      return await listMarketTags(businessDb, marketDb, input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_GET_TAG_MEMBERS,
    async (_event, input: GetTagMembersInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      return await getMarketTagMembers(businessDb, marketDb, input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_GET_TAG_SERIES,
    async (_event, input: GetTagSeriesInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      return await getMarketTagSeries(businessDb, marketDb, input);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_INSTRUMENT_REGISTRY_LIST,
    async (_event, input: ListInstrumentRegistryInput | null) => {
      const marketDb = requireMarketCacheDb();
      return await listInstrumentRegistry(marketDb, input ?? undefined);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_INSTRUMENT_REGISTRY_SET_AUTO_INGEST,
    async (_event, input: SetInstrumentAutoIngestInput) => {
      const marketDb = requireMarketCacheDb();
      const symbol = normalizeRequiredString(input?.symbol, "symbol");
      const enabled = Boolean(input?.enabled);
      await setInstrumentAutoIngest(marketDb, symbol, enabled);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_INSTRUMENT_REGISTRY_BATCH_SET_AUTO_INGEST,
    async (_event, input: BatchSetInstrumentAutoIngestInput) => {
      const marketDb = requireMarketCacheDb();
      const symbols = Array.isArray(input?.symbols)
        ? input.symbols
            .map((value) => String(value).trim())
            .filter(Boolean)
        : [];
      if (symbols.length === 0) {
        throw new Error("symbols is required.");
      }
      const enabled = Boolean(input?.enabled);
      await batchSetInstrumentAutoIngest(marketDb, symbols, enabled);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_GET_QUOTES,
    async (_event, input: GetQuotesInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      const resolved = await getResolvedTushareToken(businessDb);
      return await getMarketQuotes(marketDb, input, resolved.token);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_GET_DAILY_BARS,
    async (_event, input: GetDailyBarsInput) => {
      const businessDb = requireActiveBusinessDb();
      const marketDb = requireMarketCacheDb();
      const resolved = await getResolvedTushareToken(businessDb);
      return await getMarketDailyBars(marketDb, input, resolved.token);
    }
  );

  ipcMain.handle(IPC_CHANNELS.MARKET_SEED_DEMO_DATA, async (_event, input) => {
    const businessDb = requireActiveBusinessDb();
    const marketDb = requireMarketCacheDb();
    return await seedMarketDemoData(businessDb, marketDb, input ?? null);
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_TOKEN_GET_STATUS, async () => {
    const businessDb = requireActiveBusinessDb();
    const resolved = await getResolvedTushareToken(businessDb);
    return { source: resolved.source, configured: Boolean(resolved.token) };
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_TOKEN_SET, async (_event, input) => {
    const businessDb = requireActiveBusinessDb();
    const token = typeof input?.token === "string" ? input.token : null;
    await setTushareToken(businessDb, token);
    await markConnectivityTestsStale(businessDb);
    const resolved = await getResolvedTushareToken(businessDb);
    return { source: resolved.source, configured: Boolean(resolved.token) };
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_TOKEN_TEST, async (_event, input) => {
    const businessDb = requireActiveBusinessDb();
    const resolved = await getResolvedTushareToken(businessDb);
    const override =
      typeof input?.token === "string" ? input.token.trim() : "";
    const token = override || resolved.token;
    if (!token) {
      throw new Error("未配置 Tushare token。请先保存，或在输入框中填入 token 再测试。");
    }
    const provider = getMarketProvider("tushare");
    await provider.testToken(token);
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_DATA_SOURCE_GET_CATALOG, async () => {
    return await getMarketDataSourceCatalog();
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_DATA_SOURCE_GET_CONFIG, async () => {
    const businessDb = requireActiveBusinessDb();
    return await getMarketDataSourceConfig(businessDb);
  });

  ipcMain.handle(
    IPC_CHANNELS.MARKET_DATA_SOURCE_SET_CONFIG,
    async (_event, input) => {
      const businessDb = requireActiveBusinessDb();
      const saved = await setMarketDataSourceConfig(businessDb, input);
      await markConnectivityTestsStale(businessDb);
      return saved;
    }
  );

  ipcMain.handle(IPC_CHANNELS.MARKET_TOKEN_GET_MATRIX_STATUS, async () => {
    const businessDb = requireActiveBusinessDb();
    return await getMarketTokenMatrixStatus(businessDb);
  });

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TOKEN_SET_MAIN,
    async (_event, input: SetMarketMainTokenInput) => {
      const businessDb = requireActiveBusinessDb();
      const token = typeof input?.token === "string" ? input.token : null;
      await setMainToken(businessDb, token);
      await markConnectivityTestsStale(businessDb);
      return await getMarketTokenMatrixStatus(businessDb);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TOKEN_SET_DOMAIN,
    async (_event, input: SetMarketDomainTokenInput) => {
      const businessDb = requireActiveBusinessDb();
      const domainId = input?.domainId;
      if (!domainId) throw new Error("domainId 不能为空。");
      const token = typeof input?.token === "string" ? input.token : null;
      await setDomainToken(businessDb, domainId, token);
      await markConnectivityTestsStale(businessDb, { domainId });
      return await getMarketTokenMatrixStatus(businessDb);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TOKEN_CLEAR_DOMAIN,
    async (_event, input: ClearMarketDomainTokenInput) => {
      const businessDb = requireActiveBusinessDb();
      const domainId = input?.domainId;
      if (!domainId) throw new Error("domainId 不能为空。");
      await clearDomainToken(businessDb, domainId);
      await markConnectivityTestsStale(businessDb, { domainId });
      return await getMarketTokenMatrixStatus(businessDb);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TEST_DOMAIN_CONNECTIVITY,
    async (_event, input: TestMarketDomainConnectivityInput) => {
      const businessDb = requireActiveBusinessDb();
      const domainId = input?.domainId;
      if (!domainId) throw new Error("domainId 不能为空。");
      return await testDomainConnectivity({
        businessDb,
        domainId
      });
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MARKET_TEST_MODULE_CONNECTIVITY,
    async (_event, input: TestMarketModuleConnectivityInput) => {
      const businessDb = requireActiveBusinessDb();
      const domainId = input?.domainId;
      const moduleId =
        typeof input?.moduleId === "string" ? input.moduleId.trim() : "";
      if (!domainId) throw new Error("domainId 不能为空。");
      if (!moduleId) throw new Error("moduleId 不能为空。");
      return await testModuleConnectivity({
        businessDb,
        domainId,
        moduleId
      });
    }
  );

  ipcMain.handle(IPC_CHANNELS.MARKET_LIST_CONNECTIVITY_TESTS, async () => {
    const businessDb = requireActiveBusinessDb();
    return await listConnectivityTests(businessDb);
  });

  ipcMain.handle(
    IPC_CHANNELS.MARKET_VALIDATE_SOURCE_READINESS,
    async (_event, input: ValidateDataSourceReadinessInput | null | undefined) => {
      const businessDb = requireActiveBusinessDb();
      return await validateDataSourceReadiness({
        businessDb,
        scope: input?.scope ?? "both"
      });
    }
  );

  ipcMain.handle(IPC_CHANNELS.MARKET_PROVIDER_OPEN, async (_event, input) => {
    const provider =
      typeof input?.provider === "string" ? input.provider.trim() : "";
    if (!provider) throw new Error("provider is required.");
    const catalog = await getMarketDataSourceCatalog();
    const providerInfo = catalog.providers.find((item) => item.id === provider);
    const url = providerInfo?.homepage ?? null;
    if (!url) throw new Error(`unknown provider: ${provider}`);
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_INGEST_RUNS_LIST, async (_event, input) => {
    const marketDb = requireMarketCacheDb();
    const limit =
      input && typeof input.limit === "number" && Number.isFinite(input.limit)
        ? input.limit
        : 100;
    const runs = await listIngestRuns(marketDb, limit);
    return runs.map((row) => ({
      id: row.id,
      scope: row.scope,
      mode: row.mode,
      status: row.status,
      asOfTradeDate: row.as_of_trade_date,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      symbolCount: row.symbol_count,
      inserted: row.inserted,
      updated: row.updated,
      errors: row.errors,
      errorMessage: row.error_message,
      meta: row.meta_json ? safeParseJsonObject(row.meta_json) : null
    }));
  });

  ipcMain.handle(
    IPC_CHANNELS.MARKET_INGEST_RUN_GET,
    async (_event, input: GetIngestRunDetailInput) => {
      const marketDb = requireMarketCacheDb();
      const id = normalizeRequiredString(input?.id, "id");
      const row = await getIngestRunById(marketDb, id);
      if (!row) return null;
      return {
        id: row.id,
        scope: row.scope,
        mode: row.mode,
        status: row.status,
        asOfTradeDate: row.as_of_trade_date,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        symbolCount: row.symbol_count,
        inserted: row.inserted,
        updated: row.updated,
        errors: row.errors,
        errorMessage: row.error_message,
        meta: row.meta_json ? safeParseJsonObject(row.meta_json) : null
      };
    }
  );

  ipcMain.handle(IPC_CHANNELS.MARKET_INGEST_TRIGGER, async (_event, input) => {
    const businessDb = requireActiveBusinessDb();
    const scope = input?.scope;
    if (!scope || (scope !== "targets" && scope !== "universe" && scope !== "both")) {
      throw new Error("scope must be targets/universe/both.");
    }

    const readiness = await validateDataSourceReadiness({
      businessDb,
      scope
    });
    if (!readiness.ready) {
      throw new Error(buildReadinessBlockMessage(readiness));
    }

    await enqueueManagedIngest({
      scope,
      mode: "manual",
      source: "manual",
      meta: { schedule: "manual" }
    });
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_INGEST_CONTROL_STATUS, async () => {
    return getManagedIngestControlStatus();
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_INGEST_CONTROL_PAUSE, async () => {
    return await pauseManagedIngest();
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_INGEST_CONTROL_RESUME, async () => {
    return await resumeManagedIngest();
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_INGEST_CONTROL_CANCEL, async () => {
    return cancelManagedIngest();
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_INGEST_SCHEDULER_GET, async () => {
    const businessDb = requireActiveBusinessDb();
    return await getMarketIngestSchedulerConfig(businessDb);
  });

  ipcMain.handle(
    IPC_CHANNELS.MARKET_INGEST_SCHEDULER_SET,
    async (_event, input: MarketIngestSchedulerConfig) => {
      const businessDb = requireActiveBusinessDb();
      const saved = await setMarketIngestSchedulerConfig(businessDb, input);
      return saved;
    }
  );

  ipcMain.handle(IPC_CHANNELS.MARKET_UNIVERSE_POOL_GET_CONFIG, async () => {
    const businessDb = requireActiveBusinessDb();
    return await getLegacyUniversePoolConfigFromDataSource(businessDb);
  });

  ipcMain.handle(
    IPC_CHANNELS.MARKET_UNIVERSE_POOL_SET_CONFIG,
    async (_event, input: MarketUniversePoolConfig) => {
      const businessDb = requireActiveBusinessDb();
      const saved = await setLegacyUniversePoolConfigToDataSource(businessDb, input);
      await markConnectivityTestsStale(businessDb);
      return saved;
    }
  );

  ipcMain.handle(IPC_CHANNELS.MARKET_UNIVERSE_POOL_GET_OVERVIEW, async () => {
    const businessDb = requireActiveBusinessDb();
    const [overview, config] = await Promise.all([
      getMarketUniversePoolOverview(businessDb),
      getLegacyUniversePoolConfigFromDataSource(businessDb)
    ]);
    const enabled = new Set(config.enabledBuckets);
    return {
      ...overview,
      config,
      buckets: overview.buckets.map((bucket) => ({
        ...bucket,
        enabled: enabled.has(bucket.bucket)
      }))
    };
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_TEMP_TARGETS_LIST, async () => {
    const businessDb = requireActiveBusinessDb();
    const items = await listTempTargetSymbols(businessDb);
    return items.map((item) => ({
      symbol: item.symbol,
      expiresAt: item.expiresAt,
      updatedAt: item.updatedAt
    }));
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_TEMP_TARGETS_TOUCH, async (_event, input) => {
    const businessDb = requireActiveBusinessDb();
    const symbol = typeof input?.symbol === "string" ? input.symbol : "";
    const ttlDaysRaw = input?.ttlDays;
    const ttlDays =
      typeof ttlDaysRaw === "number" && Number.isFinite(ttlDaysRaw) ? ttlDaysRaw : 7;
    const items = await touchTempTargetSymbol(businessDb, symbol, ttlDays);
    return items.map((item) => ({
      symbol: item.symbol,
      expiresAt: item.expiresAt,
      updatedAt: item.updatedAt
    }));
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_TEMP_TARGETS_REMOVE, async (_event, input) => {
    const businessDb = requireActiveBusinessDb();
    const symbol = typeof input?.symbol === "string" ? input.symbol : "";
    const items = await removeTempTargetSymbol(businessDb, symbol);
    return items.map((item) => ({
      symbol: item.symbol,
      expiresAt: item.expiresAt,
      updatedAt: item.updatedAt
    }));
  });

  ipcMain.handle(IPC_CHANNELS.MARKET_TEMP_TARGETS_PROMOTE, async (_event, input) => {
    const businessDb = requireActiveBusinessDb();
    const symbol = typeof input?.symbol === "string" ? input.symbol.trim() : "";
    if (!symbol) throw new Error("symbol 不能为空。");

    const current = await getMarketTargetsConfig(businessDb);
    const next = current.explicitSymbols.includes(symbol)
      ? current
      : { ...current, explicitSymbols: [...current.explicitSymbols, symbol] };
    await setMarketTargetsConfig(businessDb, next);
    await removeTempTargetSymbol(businessDb, symbol);
    void triggerAutoIngest("positions");
    return await getMarketTargetsConfig(businessDb);
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERFORMANCE_RANGES = new Set([
  "1M",
  "3M",
  "6M",
  "1Y",
  "YTD",
  "ALL"
]);

function buildReadinessBlockMessage(readiness: {
  issues: Array<{ level: string; message: string }>;
}): string {
  const errors = readiness.issues.filter((item) => item.level === "error");
  if (errors.length === 0) {
    return "数据来源未就绪。";
  }
  const top = errors.slice(0, 8).map((item, index) => `${index + 1}. ${item.message}`);
  return `数据来源未就绪：\\n${top.join("\\n")}`;
}

function safeParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function normalizeLedgerEntryInput(
  businessDb: SqliteDatabase,
  input: CreateLedgerEntryInput
): Promise<CreateLedgerEntryInput> {
  const portfolioId = normalizeRequiredString(input.portfolioId, "portfolioId");
  const accountKey = normalizeOptionalString(input.accountKey);
  const eventType = normalizeRequiredString(input.eventType, "eventType") as
    | CreateLedgerEntryInput["eventType"];
  const tradeDate = normalizeDate(input.tradeDate, "tradeDate");
  const eventTs = normalizeOptionalInteger(input.eventTs, "eventTs");
  const sequence = normalizeOptionalInteger(input.sequence, "sequence");
  const source = normalizeRequiredString(input.source, "source") as
    | CreateLedgerEntryInput["source"];
  const externalId = normalizeOptionalString(input.externalId);
  const note = normalizeOptionalString(input.note);

  const instrumentId = normalizeOptionalString(input.instrumentId);
  const symbol = normalizeOptionalString(input.symbol);
  const side = normalizeSide(input.side);
  const quantity = normalizeOptionalNumber(input.quantity);
  const price = normalizeOptionalNumber(input.price);
  const priceCurrencyInput = normalizeOptionalString(input.priceCurrency);
  const cashAmount = normalizeOptionalNumber(input.cashAmount);
  const cashCurrencyInput = normalizeOptionalString(input.cashCurrency);
  const fee = normalizeOptionalNumber(input.fee);
  const tax = normalizeOptionalNumber(input.tax);
  const meta = normalizeOptionalObject(input.meta);

  const baseCurrency = await getPortfolioBaseCurrency(businessDb, portfolioId);

  if (fee !== null && fee < 0) throw new Error("fee must be >= 0.");
  if (tax !== null && tax < 0) throw new Error("tax must be >= 0.");
  if (price !== null && price < 0) throw new Error("price must be >= 0.");
  if (quantity !== null && quantity < 0) throw new Error("quantity must be >= 0.");
  if (eventTs !== null && eventTs <= 0) throw new Error("eventTs must be > 0.");
  if (sequence !== null && sequence < 0) throw new Error("sequence must be >= 0.");
  if ((source === "csv" || source === "broker_import") && sequence === null) {
    throw new Error("sequence is required for import sources.");
  }

  switch (eventType) {
    case "trade": {
      if (!symbol && !instrumentId) {
        throw new Error("trade requires symbol or instrumentId.");
      }
      if (!side) throw new Error("trade requires side.");
      if (!quantity || quantity <= 0) throw new Error("trade requires quantity > 0.");
      if (price === null) throw new Error("trade requires price.");
      if (cashAmount === null || cashAmount === 0) {
        throw new Error("trade requires cashAmount != 0.");
      }
      if (side === "buy" && cashAmount > 0) {
        throw new Error("buy trade requires cashAmount < 0.");
      }
      if (side === "sell" && cashAmount < 0) {
        throw new Error("sell trade requires cashAmount > 0.");
      }
      const cashCurrency = cashCurrencyInput ?? baseCurrency;
      const priceCurrency = priceCurrencyInput ?? cashCurrency;
      return {
        portfolioId,
        accountKey,
        eventType,
        tradeDate,
        eventTs,
        sequence,
        instrumentId,
        symbol,
        side,
        quantity,
        price,
        priceCurrency,
        cashAmount,
        cashCurrency,
        fee,
        tax,
        note,
        source,
        externalId,
        meta
      };
    }
    case "cash": {
      if (cashAmount === null || cashAmount === 0) {
        throw new Error("cash requires cashAmount != 0.");
      }
      if (!cashCurrencyInput) throw new Error("cash requires cashCurrency.");
      return {
        portfolioId,
        accountKey,
        eventType,
        tradeDate,
        eventTs,
        sequence,
        instrumentId: null,
        symbol: null,
        side: null,
        quantity: null,
        price: null,
        priceCurrency: null,
        cashAmount,
        cashCurrency: cashCurrencyInput,
        fee: null,
        tax: null,
        note,
        source,
        externalId,
        meta
      };
    }
    case "fee":
    case "tax": {
      if (cashAmount === null || cashAmount >= 0) {
        throw new Error(`${eventType} requires cashAmount < 0.`);
      }
      if (!cashCurrencyInput) throw new Error(`${eventType} requires cashCurrency.`);
      return {
        portfolioId,
        accountKey,
        eventType,
        tradeDate,
        eventTs,
        sequence,
        instrumentId,
        symbol: symbol,
        side: null,
        quantity: null,
        price: null,
        priceCurrency: null,
        cashAmount,
        cashCurrency: cashCurrencyInput,
        fee: null,
        tax: null,
        note,
        source,
        externalId,
        meta
      };
    }
    case "dividend": {
      if (!symbol && !instrumentId) {
        throw new Error("dividend requires symbol or instrumentId.");
      }
      if (cashAmount === null || cashAmount <= 0) {
        throw new Error("dividend requires cashAmount > 0.");
      }
      if (!cashCurrencyInput) throw new Error("dividend requires cashCurrency.");
      return {
        portfolioId,
        accountKey,
        eventType,
        tradeDate,
        eventTs,
        sequence,
        instrumentId,
        symbol,
        side: null,
        quantity: null,
        price: null,
        priceCurrency: null,
        cashAmount,
        cashCurrency: cashCurrencyInput,
        fee: null,
        tax,
        note,
        source,
        externalId,
        meta
      };
    }
    case "adjustment": {
      if (!symbol && !instrumentId) {
        throw new Error("adjustment requires symbol or instrumentId.");
      }
      if (!side) throw new Error("adjustment requires side.");
      if (!quantity || quantity <= 0) {
        throw new Error("adjustment requires quantity > 0.");
      }
      const cashCurrency = cashCurrencyInput ?? baseCurrency;
      const priceCurrency = priceCurrencyInput ?? cashCurrency;
      return {
        portfolioId,
        accountKey,
        eventType,
        tradeDate,
        eventTs,
        sequence,
        instrumentId,
        symbol,
        side,
        quantity,
        price,
        priceCurrency,
        cashAmount: null,
        cashCurrency,
        fee: null,
        tax: null,
        note,
        source,
        externalId,
        meta
      };
    }
    case "corporate_action": {
      if (!symbol && !instrumentId) {
        throw new Error("corporate_action requires symbol or instrumentId.");
      }
      const corporateMeta = normalizeCorporateActionMeta(meta);
      return {
        portfolioId,
        accountKey,
        eventType,
        tradeDate,
        eventTs,
        sequence,
        instrumentId,
        symbol,
        side: null,
        quantity: null,
        price: null,
        priceCurrency: null,
        cashAmount: null,
        cashCurrency: null,
        fee: null,
        tax: null,
        note,
        source,
        externalId,
        meta: corporateMeta
      };
    }
    default:
      throw new Error(`Unknown eventType: ${String(eventType)}`);
  }
}

async function normalizeLedgerEntryUpdateInput(
  businessDb: SqliteDatabase,
  input: UpdateLedgerEntryInput
): Promise<UpdateLedgerEntryInput> {
  const id = normalizeRequiredString(input.id, "id");
  const normalized = await normalizeLedgerEntryInput(businessDb, input);
  return { ...normalized, id };
}

function normalizeDate(value: unknown, field: string): string {
  const str = normalizeRequiredString(value, field);
  if (!DATE_RE.test(str)) throw new Error(`${field} must be YYYY-MM-DD.`);
  return str;
}

function normalizePerformanceRange(value: unknown): PortfolioPerformanceRangeInput["range"] {
  if (typeof value !== "string") {
    throw new Error("range must be a string.");
  }
  if (!PERFORMANCE_RANGES.has(value)) {
    throw new Error("range is invalid.");
  }
  return value as PortfolioPerformanceRangeInput["range"];
}

function normalizeRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} must not be empty.`);
  return trimmed;
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeOptionalInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (!Number.isInteger(num)) {
    throw new Error(`${field} must be an integer.`);
  }
  return num;
}

function normalizeSide(value: unknown): "buy" | "sell" | null {
  const str = normalizeOptionalString(value);
  if (!str) return null;
  if (str === "buy" || str === "sell") return str;
  throw new Error("side must be 'buy' or 'sell'.");
}

function normalizeOptionalObject(
  value: unknown
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

const CORPORATE_ACTION_CATEGORIES = new Set<CorporateActionCategory>([
  "decision",
  "org_change",
  "policy_support",
  "other"
]);

function normalizeCorporateActionMeta(
  value: Record<string, unknown> | null
): CorporateActionMeta {
  if (!value) throw new Error("corporate_action requires meta.");
  const kind = value.kind;
  if (kind === "split" || kind === "reverse_split") {
    const numerator = normalizePositiveInteger(value.numerator, "meta.numerator");
    const denominator = normalizePositiveInteger(
      value.denominator,
      "meta.denominator"
    );
    return {
      kind,
      numerator,
      denominator
    };
  }
  if (kind === "info") {
    const category = normalizeRequiredString(
      value.category,
      "meta.category"
    ) as CorporateActionCategory;
    if (!CORPORATE_ACTION_CATEGORIES.has(category)) {
      throw new Error("meta.category is invalid.");
    }
    const title = normalizeRequiredString(value.title, "meta.title");
    const description = normalizeOptionalString(value.description);
    return {
      kind,
      category,
      title,
      description
    };
  }
  throw new Error("meta.kind is invalid.");
}

function normalizePositiveInteger(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return num;
}

async function getPortfolioBaseCurrency(
  db: SqliteDatabase,
  portfolioId: string
): Promise<string> {
  const portfolio = await getPortfolio(db, portfolioId);
  if (!portfolio) throw new Error("Portfolio not found.");
  return portfolio.baseCurrency;
}
