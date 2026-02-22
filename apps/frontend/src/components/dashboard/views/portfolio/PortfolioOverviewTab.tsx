import type { ReactNode } from "react";

export interface PortfolioOverviewTabProps {
  children?: ReactNode;
}

export function PortfolioOverviewTab({ children }: PortfolioOverviewTabProps) {
  return <>{children ?? null}</>;
}
