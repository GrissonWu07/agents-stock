import type { PropsWithChildren } from "react";

type SectionEmptyStateProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function SectionEmptyState({ title, description, children }: SectionEmptyStateProps) {
  return (
    <div className="summary-item summary-item--accent">
      <div className="summary-item__title">{title}</div>
      <div className="summary-item__body">{description}</div>
      {children ? (
        <div className="chip-row" style={{ marginTop: "10px" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
