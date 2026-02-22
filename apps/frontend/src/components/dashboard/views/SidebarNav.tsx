interface SidebarNavItem {
  key: string;
  label: string;
  icon: string;
}

export interface SidebarNavProps {
  activeView: string;
  isNavCollapsed: boolean;
  items: readonly SidebarNavItem[];
  onSelectView: (view: string) => void;
  onToggleCollapse: () => void;
}

export function SidebarNav({
  activeView,
  isNavCollapsed,
  items,
  onSelectView,
  onToggleCollapse
}: SidebarNavProps) {
  return (
    <aside
      className={`${
        isNavCollapsed ? "w-16" : "w-40"
      } flex-shrink-0 bg-surface-light/95 dark:bg-surface-dark/90 backdrop-blur-xl border-r border-border-light dark:border-border-dark flex flex-col transition-all duration-300 z-20`}
    >
      <div className="flex items-center justify-between p-2 border-b border-border-light dark:border-border-dark h-10">
        <p className={`text-xs font-semibold text-slate-400 ${isNavCollapsed ? "hidden" : "block"}`}>
          导航
        </p>
        <button
          className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-background-dark/80 transition-colors"
          type="button"
          onClick={onToggleCollapse}
          aria-label={isNavCollapsed ? "展开导航" : "收起导航"}
        >
          <span className="material-icons-outlined text-lg">
            {isNavCollapsed ? "chevron_right" : "chevron_left"}
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => {
          const isActive = item.key === activeView;
          return (
            <button
              key={item.key}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                ${isActive
                  ? "bg-primary text-white font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-background-dark/80 hover:text-slate-900 dark:hover:text-white"
                }
                ${isNavCollapsed ? "justify-center px-2" : ""}
              `}
              type="button"
              onClick={() => onSelectView(item.key)}
              title={item.label}
            >
              <span
                className={`material-icons-outlined ${isNavCollapsed ? "text-xl" : "text-lg"} ${
                  isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                }`}
              >
                {item.icon}
              </span>
              {!isNavCollapsed && (
                <div className="flex flex-col items-start text-left leading-tight">
                  <span>{item.label}</span>
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
