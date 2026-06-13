import type { ReactNode } from "react";
import { apiMessage } from "./format";

/** Page wrapper with loading, error, and content states */
export function PageState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="loading-state">
        <span className="spinner" /> Loading...
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-state">
        <i className="ti ti-alert-circle" />
        <h3>Something went wrong</h3>
        <p>{apiMessage(error)}</p>
        {onRetry && (
          <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop: 12 }}>
            <i className="ti ti-refresh" /> Try Again
          </button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

/** Standard loading spinner */
export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="loading-state">
      <span className="spinner" /> {text}
    </div>
  );
}

/** Standard error display */
export function ErrorBlock({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div className="error-state">
      <i className="ti ti-alert-triangle" />
      <h3>Something went wrong</h3>
      <p>{apiMessage(error)}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry} style={{ marginTop: 12 }}>
          <i className="ti ti-refresh" /> Try Again
        </button>
      )}
    </div>
  );
}

/** Empty state placeholder (matches student's empty-state pattern) */
export function EmptyState({
  icon = "ti-database-off",
  title = "No data found",
  text,
  action,
}: {
  icon?: string;
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <i className={`ti ${icon}`} />
      <div className="empty-state-title">{title}</div>
      {text && <div className="empty-state-text">{text}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/** Feedback banner (matches student's feedback pattern) */
export function Feedback({ message, error }: { message?: string | null; error?: string | null }) {
  if (!message && !error) return null;
  return (
    <div className={`feedback ${error ? "error" : ""}`}>
      <i className={`ti ti-${error ? "alert-circle" : "circle-check"}`} />
      {error || message}
    </div>
  );
}

/** Page header with title, subtitle, and actions slot */
export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}

/** Filter chip */
export function FilterChip({
  label,
  active,
  onClick,
  onRemove,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`filter-chip ${active ? "active" : ""}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      {label}
      {onRemove && <i className="ti ti-x" style={{ fontSize: 11, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onRemove(); }} />}
    </span>
  );
}

/** Stats overview row (matches student's stat-card pattern) */
export function StatsRow({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    color?: string;
    icon?: string;
    meta?: string;
    trend?: { value: string; up?: boolean };
  }>;
}) {
  return (
    <div className="stats-grid">
      {items.map((item, i) => (
        <div key={i} className="stat-card" style={{ "--accent": accentColor(item.color), "--soft": softColor(item.color) } as React.CSSProperties}>
          <div className="stat-header">
            <div className="stat-label">{item.label}</div>
            {item.icon && (
              <div className="stat-icon">
                <i className={item.icon} />
              </div>
            )}
          </div>
          <div className="stat-value">{item.value}</div>
          <div className="stat-meta">
            {item.trend && (
              <span className="stat-trend">
                <i className={`ti ti-${item.trend.up ? "trending-up" : "trending-down"}`} style={{ fontSize: 12 }} />
                {item.trend.value}
              </span>
            )}
            {item.meta && <span>{item.meta}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function accentColor(color?: string): string {
  const map: Record<string, string> = {
    navy: "#4f55a8",
    red: "#b31234",
    primary: "#b31234",
    warning: "#94600a",
    danger: "#a30f2e",
    success: "#08775b",
    info: "#2152b3",
  };
  return map[color ?? ""] ?? "#b31234";
}

function softColor(color?: string): string {
  const map: Record<string, string> = {
    navy: "#eeefff",
    red: "#fde8ec",
    primary: "#fde8ec",
    warning: "#fff3d8",
    danger: "#ffe6ea",
    success: "#def8ee",
    info: "#f0f4ff",
  };
  return map[color ?? ""] ?? "#fde8ec";
}
