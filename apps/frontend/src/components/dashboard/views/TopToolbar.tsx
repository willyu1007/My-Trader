import { Button } from "../primitives/Buttons";

interface TopToolbarNavItem {
  key: string;
  label: string;
}

export interface TopToolbarProps {
  activeView: string;
  otherTab: string;
  navItems: readonly TopToolbarNavItem[];
  marketPriceAsOf?: string | null;
  onLock: () => Promise<void>;
}

export function TopToolbar({
  activeView,
  otherTab,
  navItems,
  marketPriceAsOf,
  onLock
}: TopToolbarProps) {
  return (
    <div className="h-10 border-b border-border-light dark:border-border-dark flex items-center justify-between px-3 flex-shrink-0 bg-white/85 dark:bg-background-dark/75 backdrop-blur-lg">
      <div className="flex items-baseline gap-3 min-w-0">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
          {activeView === "other" && otherTab === "data-status"
            ? "数据状态"
            : navItems.find((n) => n.key === activeView)?.label}
        </h2>
        {activeView === "market" && (
          <span className="relative top-[1px] text-xs font-mono text-slate-500 dark:text-slate-400">
            {marketPriceAsOf ?? "--"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {activeView === "account" && (
          <Button variant="secondary" size="sm" onClick={onLock} icon="lock">
            锁定
          </Button>
        )}
      </div>
    </div>
  );
}
