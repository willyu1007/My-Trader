import type { AccountSummary, CreateAccountInput } from "@mytrader/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Dashboard } from "./components/Dashboard";
import { GlobalHoverTooltipLayer } from "./components/GlobalHoverTooltipLayer";
import type { WorkspaceView } from "./components/dashboard/types";
import {
  getThemeMode,
  resolveTheme,
  setThemeMode,
  subscribeToSystemThemeChange,
  type ResolvedTheme,
  type ThemeMode
} from "./theme/theme-mode";

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
      return "未检测到桌面端后端（预加载接口），请使用桌面端启动应用。";
    }
    return message || "发生未知错误。";
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return "发生未知错误。";
}

export function App() {
  const loginAccountFieldId = "auth-login-account";
  const loginPasswordFieldId = "auth-login-password";
  const createLabelFieldId = "auth-create-label";
  const createPasswordFieldId = "auth-create-password";
  const createPasswordConfirmFieldId = "auth-create-password-confirm";
  const createDataRootDirFieldId = "auth-create-data-root-dir";

  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getThemeMode())
  );
  const hasDesktopApi = Boolean(window.mytrader);
  const isElectron = navigator.userAgent.toLowerCase().includes("electron");
  const isMac = navigator.platform.toLowerCase().includes("mac");
  const isDev = import.meta.env.DEV;
  const useMacTitlebarInset = isElectron && isMac;

  const [createLabel, setCreateLabel] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");
  const [createDataRootDir, setCreateDataRootDir] = useState<string | null>(null);
  const [isChoosingDataRootDir, setIsChoosingDataRootDir] = useState(false);

  const [loginAccount, setLoginAccount] = useState<string>("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isThemeMenuExpanded, setIsThemeMenuExpanded] = useState(false);
  const [dashboardActiveView, setDashboardActiveView] =
    useState<WorkspaceView>("portfolio");

  useEffect(() => {
    const resolved = setThemeMode(themeMode, { persist: true });
    setResolvedTheme(resolved);
  }, [themeMode]);

  useEffect(() => {
    if (themeMode !== "system") return;
    return subscribeToSystemThemeChange(() => {
      const resolved = setThemeMode("system", { persist: false });
      setResolvedTheme(resolved);
    });
  }, [themeMode]);

  useEffect(() => {
    if (state.kind !== "unlocked") {
      setIsSettingsOpen(false);
      setIsThemeMenuExpanded(false);
    }
  }, [state.kind]);

  useEffect(() => {
    if (!isSettingsOpen) {
      setIsThemeMenuExpanded(false);
    }
  }, [isSettingsOpen]);

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

        if (isDev) {
          let target = list[0];
          if (!target) {
            target = await window.mytrader.account.create({
              label: "开发账号",
              password: "dev",
              dataRootDir: null
            });
            if (cancelled) return;
          }

          try {
            const unlocked = await window.mytrader.account.unlock({
              accountId: target.id,
              password: "",
              devBypass: true
            });
            if (cancelled) return;
            setState({ kind: "unlocked", account: unlocked });
            setLoginAccount(unlocked.label);
            return;
          } catch (e) {
            if (cancelled) return;
            setError(toUserErrorMessage(e));
            const fallbackList = list.length > 0 ? list : [target];
            setState({ kind: "locked", accounts: fallbackList });
            if (fallbackList.length > 0) setLoginAccount(fallbackList[0]!.label);
            return;
          }
        }

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
  }, [isDev]);

  const refreshAccounts = useCallback(async (preferredLoginAccount?: string) => {
    if (!window.mytrader) {
      setError(
        "未检测到桌面端后端（预加载接口），请使用桌面端启动应用。"
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
          "未检测到桌面端后端（预加载接口），无法打开系统选择器。"
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
      setError("未检测到桌面端后端（预加载接口），无法创建账号。");
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
      setError("未检测到桌面端后端（预加载接口），无法登录。");
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
        throw new Error("未检测到桌面端后端（预加载接口），无法锁定。");
      }
      const lastLoginAccount =
        state.kind === "unlocked" ? state.account.label : undefined;
      await window.mytrader.account.lock();
      await refreshAccounts(lastLoginAccount);
      setIsSettingsOpen(false);
    } catch (e) {
      setError(toUserErrorMessage(e));
    }
  }, [refreshAccounts, state]);

  const handleActivePortfolioChange = useCallback(
    (_portfolio: { id: string | null; name: string | null }) => {},
    []
  );

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: "system", label: "跟随系统" },
    { value: "light", label: "浅色" },
    { value: "dark", label: "深色" }
  ];
  const isNavToggleDisabled = dashboardActiveView === "market";

  return (
    <div className="app h-screen flex flex-col overflow-hidden">
      <header
        className={`topbar flex-shrink-0 z-30 ${useMacTitlebarInset ? "topbar--macInset" : ""}`}
      >
        <div className="topbarLeft">
          {state.kind === "unlocked" && (
            <button
              type="button"
              className="navToggle topbarControl topbarNavToggle"
              onClick={() => setIsNavCollapsed((prev) => !prev)}
              aria-label={isNavCollapsed ? "展开导航" : "收起导航"}
              title={
                isNavToggleDisabled
                  ? "市场视图下导航固定为收起状态"
                  : isNavCollapsed
                    ? "展开导航"
                    : "收起导航"
              }
              disabled={isNavToggleDisabled}
            >
              <span
                className={`topbarNavIcon ${isNavCollapsed ? "isCollapsed" : ""}`}
                aria-hidden="true"
              >
                <span className="topbarNavIconMark" />
              </span>
            </button>
          )}
        </div>
        <div
          id="app-topbar-workspace-slot"
          className={`topbarCenter ${state.kind === "unlocked" ? "" : "isEmpty"}`}
        />
        <div className="topbarRight">
          <h1 className="topbarBrand">MyTrader</h1>
        </div>
      </header>

      <main className="content flex-1 flex flex-col min-h-0 overflow-hidden">
        {state.kind === "unlocked" ? (
          <div className="relative z-10 w-full h-full">
            <Dashboard
              account={state.account}
              onOpenSettings={() => setIsSettingsOpen(true)}
              navCollapsed={isNavCollapsed}
              onNavCollapsedChange={setIsNavCollapsed}
              onActiveViewChange={setDashboardActiveView}
              onActivePortfolioChange={handleActivePortfolioChange}
            />
          </div>
        ) : (
          <div className="authLayout flex-1 flex items-start md:items-center justify-center bg-background-light dark:bg-background-dark p-4 overflow-y-auto">
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
                        <label
                          htmlFor={loginAccountFieldId}
                          className="text-sm font-medium text-slate-600 dark:text-slate-300"
                        >
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
                            className="ui-auth-select w-full pl-9 pr-8 py-2 appearance-none transition-shadow text-sm"
                            id={loginAccountFieldId}
                            name="loginAccount"
                            autoComplete="username"
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
                        <input
                          type="text"
                          tabIndex={-1}
                          aria-hidden="true"
                          className="sr-only"
                          name="username"
                          autoComplete="username"
                          value={loginAccount}
                          readOnly
                        />

                        <label
                          htmlFor={loginPasswordFieldId}
                          className="text-sm font-medium text-slate-600 dark:text-slate-300"
                        >
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
                            className="ui-auth-input w-full pl-9 pr-3 py-2 placeholder-slate-400 transition-shadow text-sm"
                            id={loginPasswordFieldId}
                            name="unlockPassword"
                            autoComplete="current-password"
                            placeholder="******"
                            type="password"
                            value={unlockPassword}
                            onChange={(e) => setUnlockPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                          />
                        </div>
                        <div className="md:col-start-2 flex justify-end pt-1">
                          <button
                            className="ui-auth-btn ui-auth-btn-primary px-5 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.01] active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <div className="w-full border-t border-border-light dark:border-border-dark"></div>
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
                        <label
                          htmlFor={createLabelFieldId}
                          className="text-sm font-medium text-slate-600 dark:text-slate-300"
                        >
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
                            className="ui-auth-input w-full pl-9 pr-3 py-2 placeholder-slate-400 transition-shadow text-sm"
                            id={createLabelFieldId}
                            name="createLabel"
                            autoComplete="username"
                            placeholder="例如：个人"
                            type="text"
                            value={createLabel}
                            onChange={(e) => setCreateLabel(e.target.value)}
                          />
                        </div>

                        <label
                          htmlFor={createPasswordFieldId}
                          className="text-sm font-medium text-slate-600 dark:text-slate-300"
                        >
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
                            className="ui-auth-input w-full pl-9 pr-3 py-2 placeholder-slate-400 transition-shadow text-sm"
                            id={createPasswordFieldId}
                            name="createPassword"
                            autoComplete="new-password"
                            placeholder="设置密码"
                            type="password"
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                          />
                        </div>

                        <label
                          htmlFor={createPasswordConfirmFieldId}
                          className="text-sm font-medium text-slate-600 dark:text-slate-300"
                        >
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
                            className="ui-auth-input w-full pl-9 pr-3 py-2 placeholder-slate-400 transition-shadow text-sm"
                            id={createPasswordConfirmFieldId}
                            name="createPasswordConfirm"
                            autoComplete="new-password"
                            placeholder="再次输入密码"
                            type="password"
                            value={createPasswordConfirm}
                            onChange={(e) => setCreatePasswordConfirm(e.target.value)}
                          />
                        </div>

                        <label
                          htmlFor={createDataRootDirFieldId}
                          className="text-sm font-medium text-slate-600 dark:text-slate-300"
                        >
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
                              className="ui-auth-input w-full pl-9 pr-3 py-2 cursor-not-allowed text-xs text-slate-500 dark:text-slate-400"
                              id={createDataRootDirFieldId}
                              name="createDataRootDir"
                              autoComplete="off"
                              readOnly
                              type="text"
                              value={createDataRootDir || "默认：应用数据目录"}
                            />
                          </div>
                          <button
                            className="ui-auth-btn ui-auth-btn-secondary px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shrink-0"
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
                            className="ui-auth-btn ui-auth-btn-outline px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="ui-auth-alert ui-auth-alert-error mt-4 p-3 border flex items-start gap-3">
                    <span className="material-icons-outlined shrink-0 text-base">
                      error_outline
                    </span>
                    <div className="text-xs">
                      <p className="font-medium">
                        系统错误
                      </p>
                      <p className="font-mono mt-0.5">
                        {error}
                      </p>
                    </div>
                  </div>
                )}

                {!hasDesktopApi && !error && (
                  <div className="ui-auth-alert ui-auth-alert-info mt-4 p-3 border flex items-start gap-3">
                    <span className="material-icons-outlined shrink-0 text-base">
                      info
                    </span>
                    <div className="text-xs">
                      <p className="font-medium">
                        环境信息
                      </p>
                      <p className="font-mono mt-0.5">
                        {isElectron
                          ? "检测到 Electron，但预加载接口不可用。"
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
      {state.kind === "unlocked" && isSettingsOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setIsSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/20 dark:bg-black/35" />
          <section
            className="absolute left-3 bottom-3 w-[220px] max-w-[calc(100vw-24px)] rounded-lg border border-slate-200 dark:border-border-dark bg-white/95 dark:bg-surface-dark/95 backdrop-blur-xl shadow-xl p-2 space-y-1.5 topbarControl"
            role="dialog"
            aria-modal="true"
            aria-label="快捷设置"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-0">
              <div className="h-8 px-1 grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-1.5 text-slate-800 dark:text-slate-100">
                <span className="inline-flex h-5 w-[22px] items-center justify-center">
                  <span className="material-icons-outlined text-[16px] leading-none text-slate-500 dark:text-slate-400">
                    account_circle
                  </span>
                </span>
                <span className="text-[13px] leading-5 font-semibold truncate" title={state.account.label}>
                  {state.account.label}
                </span>
              </div>
              <div className="h-7 px-1 grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-1.5 text-slate-500 dark:text-slate-400">
                <span className="inline-flex h-5 w-[22px] items-center justify-center">
                  <span className="material-icons-outlined text-[16px] leading-none">badge</span>
                </span>
                <span className="text-[12px] leading-5">个人账号</span>
              </div>
            </div>

            <div className="border-t border-slate-200/80 dark:border-border-dark/80 mx-[-2px]" />

            <div className="space-y-0">
              <button
                type="button"
                className="topbarControl w-full h-8 px-1 inline-grid grid-cols-[22px_minmax(0,1fr)_16px] items-center gap-x-1.5 rounded-md text-[13px] leading-5 text-slate-900 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-background-dark/70 transition-colors"
                onClick={() => setIsThemeMenuExpanded((prev) => !prev)}
                aria-expanded={isThemeMenuExpanded}
              >
                <span className="inline-flex h-5 w-[22px] items-center justify-center">
                  <span className="material-icons-outlined text-[16px] leading-none text-slate-600 dark:text-slate-300">
                    palette
                  </span>
                </span>
                <span className="text-left truncate">主题</span>
                <span
                  className={`inline-flex h-5 w-4 items-center justify-center material-icons-outlined text-[16px] text-slate-500 transition-transform ${
                    isThemeMenuExpanded ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>
              {isThemeMenuExpanded && (
                <div
                  className="ml-[32px] mr-1 mb-0.5 rounded-md border border-slate-200/80 dark:border-border-dark/80 p-0.5 space-y-0.5"
                  role="group"
                  aria-label="主题模式"
                >
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`topbarControl w-full h-6 px-1.5 rounded text-left text-[12px] leading-4 transition-colors ${
                        themeMode === option.value
                          ? "bg-primary/12 text-primary dark:bg-primary/20"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-background-dark/70"
                      }`}
                      onClick={() => setThemeModeState(option.value)}
                      title={
                        option.value === "system"
                          ? `跟随系统（当前：${resolvedTheme === "dark" ? "深色" : "浅色"}）`
                          : option.label
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-200/80 dark:border-border-dark/80 mx-[-2px] my-0.5" />

              <button
                type="button"
                className="topbarControl w-full h-8 px-1 inline-grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-1.5 rounded-md text-[13px] leading-5 text-slate-900 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-background-dark/70 transition-colors"
                onClick={() => {
                  const shouldLogout = window.confirm("确认退出登录？");
                  if (!shouldLogout) return;
                  void handleLock();
                  setIsSettingsOpen(false);
                }}
              >
                <span className="inline-flex h-5 w-[22px] items-center justify-center">
                  <span className="material-icons-outlined text-[16px] leading-none text-slate-600 dark:text-slate-300">
                    logout
                  </span>
                </span>
                <span className="text-left truncate">退出登录</span>
              </button>
            </div>
          </section>
        </div>
      )}
      {state.kind !== "unlocked" && (
        <footer className="footer py-2 text-center text-[10px] text-slate-400 dark:text-slate-600 bg-background-light dark:bg-background-dark">
          (c) 2026 MyTrader 专业交易工作台。
        </footer>
      )}
      <GlobalHoverTooltipLayer />
    </div>
  );
}
