/**
 * Format utilities shared across faculty pages.
 */

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function apiMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred";
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Draft",
    REVIEW: "In Review",
    PUBLISHED: "Published",
    ARCHIVED: "Archived",
    IN_PROGRESS: "In Progress",
    SUBMITTED: "Submitted",
    AUTO_SUBMITTED: "Auto Submitted",
    REGISTERED: "Registered",
    CANCELLED: "Cancelled",
    PENDING: "Pending",
    REVIEWED: "Reviewed",
    RESOLVED: "Resolved",
  };
  return map[status] ?? status;
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "badge badge-draft",
    REVIEW: "badge badge-review",
    PUBLISHED: "badge badge-published",
    ARCHIVED: "badge badge-archived",
    IN_PROGRESS: "badge badge-live",
    SUBMITTED: "badge badge-published",
    AUTO_SUBMITTED: "badge badge-published",
    REGISTERED: "badge badge-published",
    CANCELLED: "badge badge-archived",
    PENDING: "badge badge-pending",
    REVIEWED: "badge badge-review",
    RESOLVED: "badge badge-resolved",
  };
  return map[status] ?? "badge badge-draft";
}

export function difficultyBadge(difficulty: string): string {
  const map: Record<string, string> = {
    EASY: "badge badge-easy",
    MEDIUM: "badge badge-medium",
    HARD: "badge badge-hard",
  };
  return map[difficulty] ?? "badge badge-medium";
}

export function typeBadge(type: string): string {
  const map: Record<string, string> = {
    MCQ: "badge badge-mcq",
    MSQ: "badge badge-msq",
    TRUE_FALSE: "badge badge-tf",
    SHORT_ANSWER: "badge badge-sa",
    LONG_ANSWER: "badge badge-la",
  };
  return map[type] ?? "badge badge-mcq";
}

export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    MCQ: "MCQ",
    MSQ: "MSQ",
    TRUE_FALSE: "T/F",
    SHORT_ANSWER: "Short Ans.",
    LONG_ANSWER: "Long Ans.",
  };
  return map[type] ?? type;
}

export function countdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
