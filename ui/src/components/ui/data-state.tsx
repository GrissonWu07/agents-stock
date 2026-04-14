import type { ReactNode } from "react";
import { WorkbenchCard } from "./workbench-card";

type DataStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

const frameStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
  minHeight: "220px",
  alignItems: "center",
};

const titleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "16px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.3rem",
  fontWeight: 800,
  marginBottom: "8px",
};

const descriptionStyle: React.CSSProperties = {
  color: "var(--text-soft)",
  lineHeight: 1.7,
  maxWidth: "820px",
};

const skeletonGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const skeletonCardStyle: React.CSSProperties = {
  minHeight: "96px",
  borderRadius: "18px",
  background: "linear-gradient(135deg, #edf3ff 0%, #f7f9ff 100%)",
  border: "1px solid var(--soft-line)",
};

export function PageLoadingState({ title, description, action }: DataStateProps) {
  return (
    <WorkbenchCard>
      <div style={frameStyle}>
        <div style={titleRowStyle}>
          <div>
            <div style={titleStyle}>{title}</div>
            <div style={descriptionStyle}>{description}</div>
          </div>
          {action ? <div>{action}</div> : null}
        </div>
        <div style={skeletonGridStyle} aria-hidden="true">
          <div style={skeletonCardStyle} />
          <div style={skeletonCardStyle} />
          <div style={skeletonCardStyle} />
        </div>
      </div>
    </WorkbenchCard>
  );
}

export function PageErrorState({ title, description, action }: DataStateProps) {
  return (
    <WorkbenchCard>
      <div style={frameStyle}>
        <div>
          <div style={titleStyle}>{title}</div>
          <div style={descriptionStyle}>{description}</div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </WorkbenchCard>
  );
}

export function PageEmptyState({ title, description, action }: DataStateProps) {
  return (
    <WorkbenchCard>
      <div style={frameStyle}>
        <div>
          <div style={titleStyle}>{title}</div>
          <div style={descriptionStyle}>{description}</div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </WorkbenchCard>
  );
}
