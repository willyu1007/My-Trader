import type { ReactNode } from "react";

export interface PortfolioRiskTabProps {
  children?: ReactNode;
}

export function PortfolioRiskTab({ children }: PortfolioRiskTabProps) {
  return <>{children ?? null}</>;
}
