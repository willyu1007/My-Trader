import type { ReactNode } from "react";

export interface PortfolioPerformanceTabProps {
  children?: ReactNode;
}

export function PortfolioPerformanceTab({ children }: PortfolioPerformanceTabProps) {
  return <>{children ?? null}</>;
}
