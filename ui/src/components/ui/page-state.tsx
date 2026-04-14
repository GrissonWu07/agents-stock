import type { ReactNode } from "react";
import { WorkbenchCard } from "./workbench-card";

type PageStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

const shellStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  minHeight: "220px",
  alignItems: "center",
};

const headingStyle: React.CSSProperties = {
  fontSize: "1.3rem",
  fontWeight: 800,
  margin: 0,
};

const descriptionStyle: React.CSSProperties = {
  color: "var(--text-soft)",
  lineHeight: 1.7,
  margin: 0,
  maxWidth: "860px",
};

const skeletonRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
};

const skeletonCardStyle: React.CSSProperties = {
  minHeight: "92px",
  borderRadius: "18px",
  border: "1px solid var(--soft-line)",
  background: "linear-gradient(135deg, #eef3ff 0%, #f9fbff 100%)",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

export function PageLoadingState({ title, description }: PageStateProps) {
  return (
    <WorkbenchCard>
      <div style={shellStyle}>
        <div>
          <h2 style={headingStyle}>{title}</h2>
          <p style={descriptionStyle}>{description}</p>
        </div>
        <div style={skeletonRowStyle} aria-hidden="true">
          <div style={skeletonCardStyle} />
          <div style={skeletonCardStyle} />
          <div style={skeletonCardStyle} />
        </div>
      </div>
    </WorkbenchCard>
  );
}

export function PageErrorState({ title, description, actionLabel, onAction }: PageStateProps) {
  return (
    <WorkbenchCard>
      <div style={shellStyle}>
        <div>
          <h2 style={headingStyle}>{title}</h2>
          <p style={descriptionStyle}>{description}</p>
        </div>
        {actionLabel && onAction ? (
          <div style={actionRowStyle}>
            <button className="button button--secondary" type="button" onClick={onAction}>
              {actionLabel}
            </button>
          </div>
        ) : null}
      </div>
    </WorkbenchCard>
  );
}

export function PageEmptyState({ title, description, actionLabel, onAction }: PageStateProps) {
  return (
    <WorkbenchCard>
      <div style={shellStyle}>
        <div>
          <h2 style={headingStyle}>{title}</h2>
          <p style={descriptionStyle}>{description}</p>
        </div>
        {actionLabel && onAction ? (
          <div style={actionRowStyle}>
            <button className="button button--secondary" type="button" onClick={onAction}>
              {actionLabel}
            </button>
          </div>
        ) : null}
      </div>
    </WorkbenchCard>
  );
}
