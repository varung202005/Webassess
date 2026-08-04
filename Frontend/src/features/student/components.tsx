import { useEffect, useState } from "react";
import type { Result, StudentSchedule } from "./types";
import { countdown, formatDate, formatTime } from "./format";

export function PageHeading({
  title,
  subtitle,
  subtitleTone = "default",
  children,
}: {
  title: string;
  subtitle: string;
  subtitleTone?: "default" | "warning";
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div><h1>{title}</h1><p className={subtitleTone === "warning" ? "subtitle-chip warning" : undefined}>{subtitle}</p></div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

export function CountdownCard({ schedule }: { schedule: StudentSchedule }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = countdown(schedule.start_time);
  return (
    <div className="countdown-card">
      <div className="eyebrow">Next registered exam</div>
      <h2>{schedule.exam.title}</h2>
      <div className="countdown-grid">
        {[
          ["Days", remaining.days],
          ["Hours", remaining.hours],
          ["Minutes", remaining.minutes],
          ["Seconds", remaining.seconds],
        ].map(([label, value]) => (
          <div className="countdown-unit" key={label}>
            <strong>{String(value).padStart(2, "0")}</strong><span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExamDetailsModal({
  schedule,
  onClose,
}: {
  schedule: StudentSchedule;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true">
        <div className="modal-header"><h2>{schedule.exam.title}</h2><button onClick={onClose}><i className="ti ti-x" /></button></div>
        <div className="modal-body">
          <div className="detail-grid">
            <Detail label="Subject" value={`${schedule.course.code || ""} ${schedule.course.name || ""}`.trim() || "Not assigned"} />
            <Detail label="Faculty" value={schedule.faculty_name || "Not assigned"} />
            <Detail label="Date" value={formatDate(schedule.start_time)} />
            <Detail label="Window" value={`${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}`} />
            <Detail label="Duration" value={`${schedule.exam.duration_minutes} minutes`} />
            <Detail label="Maximum Marks" value={String(schedule.exam.total_marks)} />
            <Detail label="Registration Deadline" value={formatDate(schedule.registration_deadline || schedule.start_time, true)} />
            <Detail label="Eligibility" value={schedule.eligibility_status} />
          </div>
          {schedule.exam.instructions && <div className="modal-copy"><strong>Instructions</strong><p>{schedule.exam.instructions}</p></div>}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

export function ResultModal({ result, onClose }: { result: Result; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true">
        <div className="modal-header"><h2>Result Details</h2><button onClick={onClose}><i className="ti ti-x" /></button></div>
        <div className="modal-body">
          <h3>{result.exam.title}</h3>
          <p className="modal-subtitle">{result.course.code} · {result.course.name}</p>
          <div className="detail-grid">
            <Detail label="Marks" value={`${result.total_score} / ${result.max_score}`} />
            <Detail label="Percentage" value={`${result.percentage.toFixed(2)}%`} />
            <Detail label="Grade" value={result.grade || "Not assigned"} />
            <Detail label="Status" value={result.is_passed ? "Pass" : "Fail"} />
            <Detail label="Rank" value={result.rank ? `#${result.rank}` : "Not available"} />
            <Detail label="Percentile" value={result.percentile != null ? `${result.percentile.toFixed(2)}th` : "Not available"} />
          </div>
          <div className="modal-copy"><strong>Faculty remarks</strong><p>{result.faculty_remarks || "No remarks published."}</p></div>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => downloadResult(result)}><i className="ti ti-download" />Download</button></div>
      </section>
    </div>
  );
}

export function downloadResult(result: Result) {
  const content = [
    "ONLINE EXAMINATION PORTAL - RESULT",
    `Exam: ${result.exam.title}`,
    `Course: ${result.course.code || ""} ${result.course.name || ""}`.trim(),
    `Marks: ${result.total_score} / ${result.max_score}`,
    `Percentage: ${result.percentage.toFixed(2)}%`,
    `Grade: ${result.grade || "N/A"}`,
    `Status: ${result.is_passed ? "PASS" : "FAIL"}`,
    `Rank: ${result.rank ?? "N/A"}`,
    `Percentile: ${result.percentile ?? "N/A"}`,
    `Faculty remarks: ${result.faculty_remarks || "None"}`,
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${result.exam.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-result.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function StatsRow({
  items,
  className,
}: {
  items: Array<{
    label: string;
    value: string | number;
    color?: string;
    icon?: string;
    meta?: string;
    trend?: { value: string; up?: boolean };
  }>;
  className?: string;
}) {
  return (
    <div className={`stats-grid ${className ?? ""}`}>
      {items.map((item, i) => (
        <div key={i} className="stat-card" style={{ "--accent": accentColor(item.color), "--soft": softColor(item.color) } as React.CSSProperties}>
          <div className="stat-header">
            <div className="stat-label">{item.label}</div>
            {item.icon && (
              <div className="stat-icon" style={{ background: softColor(item.color), color: accentColor(item.color) }}>
                <i className={`ti ${item.icon}`} />
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

