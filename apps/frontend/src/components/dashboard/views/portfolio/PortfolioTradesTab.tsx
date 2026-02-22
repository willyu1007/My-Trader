import type { ReactNode } from "react";

export interface PortfolioTradesTabProps {
  children?: ReactNode;
}

export function PortfolioTradesTab({ children }: PortfolioTradesTabProps) {
  return <>{children ?? null}</>;
}
