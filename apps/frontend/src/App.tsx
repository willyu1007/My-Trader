import type { AccountSummary, CreateAccountInput } from "@mytrader/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Dashboard } from "./components/Dashboard";

type ViewState =
  | { kind: "loading" }
  | { kind: "locked"; accounts: AccountSummary[] }
  | { kind: "unlocked"; account: AccountSummary };

function isDesktopApiMissingError(message: string) {
  return (
    message.includes("Cannot read properties of undefined") ||
    message.includes("window.mytrader") ||
    message.includes("mytrader is not defined")
  );
}

function toUserErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message?.trim() ?? "";
    if (isDesktopApiMissingError(message)) {
      return "未检测到桌面端后端（preload API），请使用桌面端启动应用。";
    }
    return message || "发生未知错误。";
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return "发生未知错误。";
}

export function App() {
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const hasDesktopApi = Boolean(window.mytrader);
  const isElectron = navigator.userAgent.toLowerCase().includes("electron");

  const [createLabel, setCreateLabel] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");
  const [createDataRootDir, setCreateDataRootDir] = useState<string | null>(null);
  const [isChoosingDataRootDir, setIsChoosingDataRootDir] = useState(false);

  const [loginAccount, setLoginAccount] = useState<string>("");
  const [unlockPassword, setUnlockPassword] = useState("");

  const accounts = useMemo(() => {
    if (state.kind !== "locked") return [];
    return state.accounts;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!window.mytrader) {
          setState({ kind: "locked", accounts: [] });
          return;
        }

        const active = await window.mytrader.account.getActive();
        if (cancelled) return;
        if (active) {
          setState({ kind: "unlocked", account: active });
          setLoginAccount(active.label);
          return;
        }

        const list = await window.mytrader.account.list();
        if (cancelled) return;
        setState({ kind: "locked", accounts: list });
        if (list.length > 0) setLoginAccount(list[0]!.label);
      } catch (e) {
        if (cancelled) return;
        setError(toUserErrorMessage(e));
        setState({ kind: "locked", accounts: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAccounts = useCallback(async (preferredLoginAccount?: string) => {
    if (!window.mytrader) {
      setError(
        "未检测到桌面端后端（preload API），请使用桌面端启动应用。"
      );
      setState({ kind: "locked", accounts: [] });
      return;
    }
    const list = await window.mytrader.account.list();
    setState({ kind: "locked", accounts: list });
    const preferred = preferredLoginAccount?.trim();
    if (preferred) {
      setLoginAccount(preferred);
      return;
    }
    if (list.length > 0) setLoginAccount(list[0]!.label);
    else setLoginAccount("");
  }, []);

  const chooseDataRootDir = useCallback(async () => {
    setError(null);
    setIsChoosingDataRootDir(true);
    try {
      if (!window.mytrader) {
        throw new Error(
          "未检测到桌面端后端（preload API），无法打开系统选择器。"
        );
      }
      const selected = await window.mytrader.account.chooseDataRootDir();
      if (selected) setCreateDataRootDir(selected);
    } catch (e) {
      setError(toUserErrorMessage(e));
    } finally {
      setIsChoosingDataRootDir(false);
    }
  }, []);

  const handleCreateAccount = useCallback(async () => {
    setError(null);
    if (!window.mytrader) {
      setError("未检测到桌面端后端（preload API），无法创建账号。");
      return;
    }
    if (createPassword !== createPasswordConfirm) {
      setError("两次密码不一致。");
      return;
    }
    const input: CreateAccountInput = {
      label: createLabel.trim(),
      password: createPassword,
      dataRootDir: createDataRootDir?.trim() ? createDataRootDir.trim() : null
    };

    try {
      const created = await window.mytrader.account.create(input);
      setCreateLabel("");
      setCreatePassword("");
      setCreatePasswordConfirm("");
      setCreateDataRootDir(null);
      await refreshAccounts(created.label);
    } catch (e) {
      setError(toUserErrorMessage(e));
    }
  }, [
    createDataRootDir,
    createLabel,
    createPassword,
    createPasswordConfirm,
    refreshAccounts
  ]);

  const handleUnlock = useCallback(async () => {
    setError(null);
    if (!window.mytrader) {
      setError("未检测到桌面端后端（preload API），无法登录。");
      return;
    }
    const loginAccountTrimmed = loginAccount.trim();
    const account = accounts.find(
      (a) => a.label === loginAccountTrimmed || a.id === loginAccountTrimmed
    );
    if (!account) {
      setError(accounts.length === 0 ? "暂无账号，请先创建账号。" : "账号不存在。");
      return;
    }
    try {
      const unlocked = await window.mytrader.account.unlock({
        accountId: account.id,
        password: unlockPassword
      });
      setUnlockPassword("");
      setState({ kind: "unlocked", account: unlocked });
    } catch (e) {
      setError(toUserErrorMessage(e));
    }
  }, [accounts, loginAccount, unlockPassword]);

  const handleLock = useCallback(async () => {
    setError(null);
    try {
      if (!window.mytrader) {
        throw new Error("未检测到桌面端后端（preload API），无法锁定。");
      }
      const lastLoginAccount =
        state.kind === "unlocked" ? state.account.label : undefined;
      await window.mytrader.account.lock();
      await refreshAccounts(lastLoginAccount);
    } catch (e) {
      setError(toUserErrorMessage(e));
    }
  }, [refreshAccounts, state]);

  return (
    <div className="app h-screen flex flex-col overflow-hidden">
      <header className="topbar h-10 flex items-center justify-between px-3 bg-white dark:bg-[#0B0E14] border-b border-border-light dark:border-border-dark flex-shrink-0 z-30">
        <div className="brandGroup flex items-center gap-2">
          <div className="brandMark w-5 h-5 bg-primary rounded flex items-center justify-center text-white font-bold text-[10px] shadow-sm">M</div>
          <h1 className="brand text-sm font-bold tracking-tight text-slate-900 dark:text-white">MyTrader</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="badge text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">MVP 基础</div>
          {state.kind === "unlocked" && (
            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium px-2 border-l border-slate-200 dark:border-slate-800">
              {state.account.label}
            </div>
          )}
        </div>
      </header>

      <main className="content flex-1 flex flex-col min-h-0 overflow-hidden">
        {state.kind === "unlocked" ? (
          <div className="relative z-10 w-full h-full">
            <Dashboard account={state.account} onLock={handleLock} />
          </div>
        ) : (
          <div className="authLayout flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
            <div className="card authCard max-w-md w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl dark:shadow-lg overflow-hidden">
              <div className="p-6 space-y-6">
                {state.kind === "loading" ? (
                  <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
                    加载中...
                  </div>
                ) : (
                  <>
                    <section>
                      <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white border-l-4 border-primary pl-3">
                        <h2 className="text-lg font-semibold">登录</h2>
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          （已有账号）
                        </span>
                      </div>
                      <form className="grid grid-cols-1 md:grid-cols-[90px_1fr] gap-y-4 gap-x-4 items-center">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          账号
                          <span className="block text-[10px] text-slate-400 font-normal">
                            用于登录
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <span className="material-icons-outlined text-lg">
                              account_circle
                            </span>
                          </span>
                          <select
                            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900/50 border border-border-light dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-primary focus:border-primary appearance-none transition-shadow text-sm"
                            value={loginAccount}
                            onChange={(e) => setLoginAccount(e.target.value)}
                          >
                            {accounts.length === 0 ? (
                              <option value="" disabled>
                                暂无账号，请先创建
                              </option>
                            ) : (
                              <>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.label}>
                                    {a.label}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-slate-400">
                            <span className="material-icons-outlined text-lg">
                              expand_more
                            </span>
                          </span>
                        </div>

                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          密码
                          <span className="block text-[10px] text-slate-400 font-normal">
                            登录密码
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <span className="material-icons-outlined text-lg">lock</span>
                          </span>
                          <input
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-border-light dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-400 dark:placeholder-slate-600 transition-shadow text-sm"
                            placeholder="******"
                            type="password"
                            value={unlockPassword}
                            onChange={(e) => setUnlockPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                          />
                        </div>
                        <div className="md:col-start-2 flex justify-end pt-1">
                          <button
                            className="bg-primary hover:bg-[#06b6d4] text-white px-5 py-2 rounded-lg text-sm font-medium shadow-md shadow-primary/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                            onClick={handleUnlock}
                            disabled={!loginAccount || !unlockPassword}
                          >
                            <span className="material-icons-outlined text-sm">login</span>
                            登录
                          </button>
                        </div>
                      </form>
                    </section>

                    <div className="relative py-2">
                      <div aria-hidden="true" className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border-light dark:border-slate-700"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-surface-light dark:bg-surface-dark px-2 text-[10px] text-slate-400 uppercase tracking-wider">
                          或创建账号
                        </span>
                      </div>
                    </div>

                    <section>
                      <div className="flex items-center gap-2 mb-4 text-slate-900 dark:text-white border-l-4 border-primary pl-3">
                        <h2 className="text-lg font-semibold">创建账号</h2>
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          （新建）
                        </span>
                      </div>
                      <form className="grid grid-cols-1 md:grid-cols-[90px_1fr] gap-y-4 gap-x-4 items-center">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          名称
                          <span className="block text-[10px] text-slate-400 font-normal">
                            账号名称
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <span className="material-icons-outlined text-lg">badge</span>
                          </span>
                          <input
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-border-light dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-400 dark:placeholder-slate-600 transition-shadow text-sm"
                            placeholder="例如：个人"
                            type="text"
                            value={createLabel}
                            onChange={(e) => setCreateLabel(e.target.value)}
                          />
                        </div>

                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          密码
                          <span className="block text-[10px] text-slate-400 font-normal">
                            设置密码
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <span className="material-icons-outlined text-lg">vpn_key</span>
                          </span>
                          <input
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-border-light dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-400 dark:placeholder-slate-600 transition-shadow text-sm"
                            placeholder="设置密码"
                            type="password"
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                          />
                        </div>

                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          确认密码
                          <span className="block text-[10px] text-slate-400 font-normal">
                            再次确认
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <span className="material-icons-outlined text-lg">
                              check_circle_outline
                            </span>
                          </span>
                          <input
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-border-light dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-primary focus:border-primary placeholder-slate-400 dark:placeholder-slate-600 transition-shadow text-sm"
                            placeholder="再次输入密码"
                            type="password"
                            value={createPasswordConfirm}
                            onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                          />
                        </div>

                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          数据目录
                          <span className="block text-[10px] text-slate-400 font-normal">
                            数据存放
                          </span>
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <span className="material-icons-outlined text-lg">folder</span>
                            </span>
                            <input
                              className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-border-light dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 focus:ring-0 focus:border-slate-600 cursor-not-allowed text-xs"
                              readOnly
                              type="text"
                              value={createDataRootDir || "默认：应用数据目录"}
                            />
                          </div>
                          <button
                            className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg border border-transparent text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
                            type="button"
                            onClick={chooseDataRootDir}
                            disabled={isChoosingDataRootDir}
                          >
                            <span className="material-icons-outlined text-base">
                              folder_open
                            </span>
                            <span>{isChoosingDataRootDir ? "..." : "选择..."}</span>
                          </button>
                        </div>

                        <div className="md:col-start-2 flex justify-end pt-1">
                          <button
                            className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-white px-5 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-md hover:shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="button"
                            onClick={handleCreateAccount}
                            disabled={
                              !createLabel ||
                              !createPassword ||
                              createPassword !== createPasswordConfirm
                            }
                          >
                            <span className="material-icons-outlined text-sm">
                              add_circle_outline
                            </span>
                            创建
                          </button>
                        </div>
                      </form>
                    </section>
                  </>
                )}

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 flex items-start gap-3">
                    <span className="material-icons-outlined text-red-500 dark:text-red-400 shrink-0 text-base">
                      error_outline
                    </span>
                    <div className="text-xs">
                      <p className="font-medium text-red-800 dark:text-red-300">
                        系统错误
                      </p>
                      <p className="text-red-600 dark:text-red-400 font-mono mt-0.5">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {!hasDesktopApi && !error && (
                  <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 flex items-start gap-3">
                    <span className="material-icons-outlined text-blue-500 dark:text-blue-400 shrink-0 text-base">
                      info
                    </span>
                    <div className="text-xs">
                      <p className="font-medium text-blue-800 dark:text-blue-300">
                        环境信息
                      </p>
                      <p className="text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                        {isElectron
                          ? "检测到 Electron，但 preload API 不可用。"
                          : "浏览器模式：未加载桌面端后端。"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      {state.kind !== "unlocked" && (
        <footer className="footer py-2 text-center text-[10px] text-slate-400 dark:text-slate-600 bg-background-light dark:bg-background-dark">
          (c) 2026 MyTrader 专业交易工作台。
        </footer>
      )}
    </div>
  );
}
