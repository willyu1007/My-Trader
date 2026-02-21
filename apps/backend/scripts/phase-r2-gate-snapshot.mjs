import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--baseline-run-id") {
      args.baselineRunId = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--baseline-started-at-ms") {
      args.baselineStartedAtMs = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--user-data") {
      args.userData = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--target-clean-days") {
      args.targetCleanDays = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
  }
  return args;
}

function defaultUserDataDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "@mytrader/backend");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "@mytrader/backend");
  }
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(xdg, "@mytrader/backend");
}

function runSql(sqlitePath, sql) {
  return execFileSync("sqlite3", [sqlitePath, sql], { encoding: "utf8" }).trim();
}

function readLines(sqlitePath, sql) {
  const raw = runSql(sqlitePath, sql);
  if (!raw) return [];
  return raw.split("\n").filter(Boolean);
}

function readSingleValue(sqlitePath, sql) {
  const raw = runSql(sqlitePath, sql);
  if (!raw) return null;
  return raw;
}

function readBaselineStartedAt(marketDb, baselineRunId, baselineStartedAtMs) {
  if (baselineStartedAtMs) {
    const parsed = Number(baselineStartedAtMs);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (baselineRunId) {
    const value = readSingleValue(
      marketDb,
      `select started_at from ingest_runs where id='${baselineRunId.replace(/'/g, "''")}';`
    );
    const parsed = Number(value ?? "");
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

function parseFlags(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function parseCursorRows(lines) {
  const out = {};
  for (const line of lines) {
    const idx = line.indexOf("|");
    if (idx < 0) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    out[key] = value;
  }
  return out;
}

function parseDailyStats(lines) {
  return lines.map((line) => {
    const [day, runs, blocking] = line.split("|");
    return {
      day,
      runs: Number(runs ?? "0"),
      blockingLikeRuns: Number(blocking ?? "0")
    };
  });
}

function parseAsOfStats(lines) {
  return lines.map((line) => {
    const [asOfTradeDate, runs, blocking] = line.split("|");
    return {
      asOfTradeDate,
      runs: Number(runs ?? "0"),
      blockingLikeRuns: Number(blocking ?? "0")
    };
  });
}

function buildCleanDayProgress(byDayDesc, targetCleanDays) {
  const normalizedTarget = Number.isFinite(Number(targetCleanDays))
    ? Math.max(1, Math.floor(Number(targetCleanDays)))
    : 3;
  let consecutive = 0;
  for (const day of byDayDesc) {
    if (day.runs > 0 && day.blockingLikeRuns === 0) {
      consecutive += 1;
      continue;
    }
    break;
  }
  return {
    targetCleanDays: normalizedTarget,
    consecutiveCleanDays: consecutive,
    reached: consecutive >= normalizedTarget
  };
}

function buildCleanAsOfProgress(byAsOfDesc, targetCleanDays) {
  const normalizedTarget = Number.isFinite(Number(targetCleanDays))
    ? Math.max(1, Math.floor(Number(targetCleanDays)))
    : 3;
  let consecutive = 0;
  for (const day of byAsOfDesc) {
    if (day.runs > 0 && day.blockingLikeRuns === 0) {
      consecutive += 1;
      continue;
    }
    break;
  }
  return {
    targetCleanAsOfDays: normalizedTarget,
    consecutiveCleanAsOfDays: consecutive,
    reached: consecutive >= normalizedTarget
  };
}

function parseLatestSuccess(line) {
  if (!line) return null;
  const [id, startedLocal, asOfTradeDate, recoverySummaryRaw] = line.split("|");
  let recoverySummary = null;
  if (recoverySummaryRaw) {
    try {
      recoverySummary = JSON.parse(recoverySummaryRaw);
    } catch {
      recoverySummary = recoverySummaryRaw;
    }
  }
  return {
    id,
    startedLocal,
    asOfTradeDate: asOfTradeDate || null,
    recoverySummary
  };
}

function main() {
  const args = parseArgs(process.argv);
  const userData =
    args.userData || process.env.MYTRADER_USER_DATA || defaultUserDataDir();
  const accountIndex = path.join(userData, "account-index.sqlite");
  const marketDb = path.join(userData, "market-cache.sqlite");

  const accountDir = readSingleValue(
    accountIndex,
    "select data_dir from accounts order by coalesce(last_login_at,0) desc, created_at desc limit 1;"
  );
  if (!accountDir) {
    throw new Error("no active account found in account-index.sqlite");
  }
  const businessDb = path.join(accountDir, "business.sqlite");

  const baselineStartedAt = readBaselineStartedAt(
    marketDb,
    args.baselineRunId,
    args.baselineStartedAtMs
  );
  const baselineFilter =
    baselineStartedAt && Number.isFinite(baselineStartedAt)
      ? ` and started_at >= ${Math.floor(baselineStartedAt)}`
      : "";

  const sevenDayStatsDesc = parseDailyStats(
    readLines(
      marketDb,
      `select date(started_at/1000,'unixepoch','localtime') as day, count(*) as runs, sum(case when status='failed' or coalesce(errors,0)>0 then 1 else 0 end) as blocking_like_runs from ingest_runs where scope='universe'${baselineFilter} group by day order by day desc limit 7;`
    )
  );
  const sevenDayStatsAsc = [...sevenDayStatsDesc].reverse();
  const progress = buildCleanDayProgress(
    sevenDayStatsDesc,
    args.targetCleanDays || "3"
  );
  const asOfStatsDesc = parseAsOfStats(
    readLines(
      marketDb,
      `select as_of_trade_date, count(*) as runs, sum(case when status='failed' or coalesce(errors,0)>0 then 1 else 0 end) as blocking_like_runs from ingest_runs where scope='universe' and as_of_trade_date is not null${baselineFilter} group by as_of_trade_date order by as_of_trade_date desc limit 20;`
    )
  );
  const asOfStatsAsc = [...asOfStatsDesc].reverse();
  const asOfProgress = buildCleanAsOfProgress(
    asOfStatsDesc,
    args.targetCleanDays || "3"
  );

  const postBaselineAggRaw = readSingleValue(
    marketDb,
    `select count(*) as runs_after_baseline, coalesce(sum(case when status='failed' or coalesce(errors,0)>0 then 1 else 0 end),0) as blocking_after_baseline from ingest_runs where scope='universe'${baselineFilter};`
  );
  const [runsAfterBaselineRaw, blockingAfterBaselineRaw] = (postBaselineAggRaw ?? "0|0").split("|");

  const runningCount = Number(
    readSingleValue(
      marketDb,
      "select count(*) from ingest_runs where status='running';"
    ) ?? "0"
  );

  const flagsRaw =
    readSingleValue(
      businessDb,
      "select value_json from market_settings where key='rollout_flags_v1';"
    ) ?? "";
  const flags = parseFlags(flagsRaw);

  const cursorRows = parseCursorRows(
    readLines(
      marketDb,
      "select key,value from market_meta where key in ('universe_last_trade_date','universe_index_daily_cursor_v1','universe_daily_basic_cursor_v1','universe_moneyflow_cursor_v1') order by key;"
    )
  );

  const qualityRaw =
    readSingleValue(
      marketDb,
      "select count(*) as total_rows, sum(case when symbol is null or trade_date is null or close is null then 1 else 0 end) as null_rows, round(100.0 * sum(case when symbol is null or trade_date is null or close is null then 1 else 0 end)/nullif(count(*),0),4) as null_pct from daily_prices;"
    ) ?? "0|0|0";
  const [totalRowsRaw, nullRowsRaw, nullPctRaw] = qualityRaw.split("|");

  const pkConflicts = Number(
    readSingleValue(
      marketDb,
      "select count(*) from (select symbol,trade_date,count(*) c from daily_prices group by symbol,trade_date having c>1);"
    ) ?? "0"
  );
  const futureLeakCount = Number(
    readSingleValue(
      marketDb,
      "select count(*) from macro_module_snapshot where available_date > as_of_trade_date;"
    ) ?? "0"
  );

  const latestSuccess = parseLatestSuccess(
    readSingleValue(
      marketDb,
      "select id, datetime(started_at/1000,'unixepoch','localtime') as started_local, as_of_trade_date, json_extract(meta_json,'$.recoverySummary') as recovery_summary from ingest_runs where scope='universe' and status='success' order by started_at desc limit 1;"
    )
  );

  const output = {
    generatedAt: new Date().toISOString(),
    userData,
    accountDir,
    marketDb,
    businessDb,
    baseline: {
      runId: args.baselineRunId || null,
      startedAtMs: baselineStartedAt
    },
    postBaseline: {
      runs: Number(runsAfterBaselineRaw ?? "0"),
      blockingLikeRuns: Number(blockingAfterBaselineRaw ?? "0"),
      byDay: sevenDayStatsAsc,
      cleanDayProgress: progress,
      byAsOfTradeDate: asOfStatsAsc,
      cleanAsOfTradeDateProgress: asOfProgress
    },
    runtime: {
      runningCount,
      flags,
      cursors: cursorRows
    },
    quality: {
      totalRows: Number(totalRowsRaw ?? "0"),
      nullRows: Number(nullRowsRaw ?? "0"),
      nullPct: Number(nullPctRaw ?? "0"),
      pkConflicts,
      macroFutureLeakCount: futureLeakCount
    },
    latestSuccess
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
