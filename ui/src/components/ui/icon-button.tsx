import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonTone = "neutral" | "accent" | "danger";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  tone?: IconButtonTone;
  compact?: boolean;
};

const TONE_STYLES: Record<IconButtonTone, React.CSSProperties> = {
  neutral: {
    background: "#fff",
    color: "var(--text-strong)",
    borderColor: "var(--soft-line)",
  },
  accent: {
    background: "var(--accent-soft)",
    color: "var(--accent)",
    borderColor: "rgba(79, 110, 247, 0.22)",
  },
  danger: {
    background: "rgba(239, 83, 80, 0.08)",
    color: "#c93d39",
    borderColor: "rgba(239, 83, 80, 0.2)",
  },
};

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
  borderRadius: 12,
  border: "1px solid transparent",
  fontSize: "0.95rem",
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(31, 42, 68, 0.06)",
  transition: "transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease",
};

const compactStyle: React.CSSProperties = {
  minWidth: 34,
  minHeight: 34,
  padding: "0 10px",
};

export function IconButton({
  icon,
  label,
  tone = "neutral",
  compact = true,
  style,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={label}
      style={{
        ...baseStyle,
        ...(compact ? compactStyle : {}),
        ...TONE_STYLES[tone],
        ...(style ?? {}),
      }}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
