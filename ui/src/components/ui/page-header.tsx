import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  alignItems: "flex-start",
  marginBottom: "18px",
  flexWrap: "wrap",
};

const contentStyle: React.CSSProperties = {
  minWidth: 0,
  flex: "1 1 420px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "10px",
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div style={headerStyle}>
      <div style={contentStyle}>
        {eyebrow ? <div className="page-header__eyebrow">{eyebrow}</div> : null}
        <h1 className="page-header__title">{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      {actions ? <div style={actionsStyle}>{actions}</div> : null}
    </div>
  );
}
