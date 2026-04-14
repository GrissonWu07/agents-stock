import type { PropsWithChildren } from "react";

type WorkbenchCardProps = PropsWithChildren<{
  className?: string;
}>;

export function WorkbenchCard({ className = "", children }: WorkbenchCardProps) {
  return <section className={`card section-card ${className}`.trim()}>{children}</section>;
}
