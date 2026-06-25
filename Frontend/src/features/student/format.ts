export function initials(name?: string) {
  return (name || "Student")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Parses a datetime string from the backend safely.
 * If the string has no timezone info (no Z, no +/-HH:MM),
 * we treat it as IST (Asia/Kolkata, UTC+5:30) by appending +05:30.
 * This prevents JavaScript from wrongly interpreting it as UTC.
 */
function parseDate(value: string): Date {
  const hasTimezone = /[Zz]$|[+-]\d{2}:\d{2}$/.test(value.trim());
  return new Date(hasTimezone ? value : `${value}+05:30`);
}

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(parseDate(value));
}

export function formatTime(value?: string | null) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(parseDate(value));
}

export function relativeTime(value: string) {
  const seconds = Math.round((parseDate(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(seconds, "second");
}

export function countdown(target?: string | null) {
  if (!target) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const total = Math.max(0, parseDate(target).getTime() - Date.now());
  return {
    total,
    days: Math.floor(total / 86_400_000),
    hours: Math.floor(total / 3_600_000) % 24,
    minutes: Math.floor(total / 60_000) % 60,
    seconds: Math.floor(total / 1000) % 60,
  };
}

export function apiMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function reevaluationLabel(status: string) {
  return ({
    PENDING: "Submitted",
    REVIEWING: "Under Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    RESOLVED: "Completed",
    COMPLETED: "Completed",
  } as Record<string, string>)[status] ?? status.replace(/_/g, " ");
}