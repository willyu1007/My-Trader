import type { ReactNode } from "react";

export interface PortfolioHoldingsTabProps {
  children?: ReactNode;
}

export function PortfolioHoldingsTab({ children }: PortfolioHoldingsTabProps) {
  return <>{children ?? null}</>;
}
