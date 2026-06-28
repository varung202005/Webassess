/**
 * features/proctor/CandidateGrid.tsx
 *
 * Proctor dashboard panel — shows the latest webcam snapshot
 * for every active student, refreshed every 30 seconds.
 *
 * Data source: Supabase Storage bucket "exam-snapshots"
 * Path pattern: {student_id}/{attempt_id}/{timestamp}.jpg
 *
 * The panel lists all flagged attempts and resolves their latest
 * snapshot URL from Storage. A Supabase Realtime channel triggers
 * a refresh whenever a new face_verification_log is inserted.
 *
 * Place at: Frontend/src/features/proctor/CandidateGrid.tsx
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import type { FlaggedAttempt } from "./types";
import { integrityColor, scoreDisplay, studentName } from "./format";

interface CandidateGridProps {
  /** All flagged attempts — used to resolve student IDs and attempt IDs */
  attempts: FlaggedAttempt[];
  /** Refresh interval in ms. Default: 30000 */
  refreshMs?: number;
}

interface CandidateCard {
  attemptId:   string;
  studentId:   string;
  name:        string;
  score:       number;
  snapshotUrl: string | null;
  capturedAt:  number | null;
  loading:     boolean;
  error:       boolean;
}

const BUCKET          = "exam-snapshots";
const DEFAULT_REFRESH = 30_000;

// ── Fetch the most recent snapshot for an attempt ──────────────────────────────
async function fetchLatestSnapshot(
  studentId: string,
  attemptId: string
): Promise<{ url: string; ts: number } | null> {
  const prefix = `${studentId}/${attemptId}/`;
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit:  1,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error || !data?.length) return null;

  const file = data[0];
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(`${prefix}${file.name}`);

  // Add cache-busting so browser always re-fetches
  const url = `${urlData.publicUrl}?t=${Date.now()}`;
  const ts  = file.updated_at ? new Date(file.updated_at).getTime() : Date.now();
  return { url, ts };
}

export default function CandidateGrid({
  attempts,
  refreshMs = DEFAULT_REFRESH,
}: CandidateGridProps) {
  const [cards, setCards] = useState<CandidateCard[]>([]);

  // Build initial card list from attempts
  useEffect(() => {
    if (!attempts.length) { setCards([]); return; }
    setCards(
      attempts.map((a) => ({
        attemptId:   a.attempt_id,
        studentId:   a.exam_attempts?.student_id ?? "",
        name:        studentName(a),
        score:       scoreDisplay(a.integrity_score),
        snapshotUrl: null,
        capturedAt:  null,
        loading:     true,
        error:       false,
      }))
    );
  }, [attempts]);

  // Fetch snapshots for all cards
  const refreshAll = useCallback(async () => {
    if (!cards.length) return;
    const updates = await Promise.all(
      cards.map(async (card) => {
        if (!card.studentId) return { ...card, loading: false, error: true };
        try {
          const result = await fetchLatestSnapshot(card.studentId, card.attemptId);
          return {
            ...card,
            snapshotUrl: result?.url ?? null,
            capturedAt:  result?.ts  ?? null,
            loading:     false,
            error:       !result,
          };
        } catch {
          return { ...card, loading: false, error: true };
        }
      })
    );
    setCards(updates);
  }, [cards]);

  // Initial load + periodic refresh
  useEffect(() => {
    void refreshAll();
    const timer = setInterval(() => void refreshAll(), refreshMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs, attempts.length]);

  // Realtime: re-fetch when a new face log is inserted (means new snapshot)
  useEffect(() => {
    const ch = supabase
      .channel("candidate-grid-refresh")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "face_verification_logs" },
        (payload) => {
          const newAttemptId = (payload.new as Record<string, unknown>).attempt_id as string;
          setCards((prev) =>
            prev.map((c) =>
              c.attemptId === newAttemptId ? { ...c, loading: true } : c
            )
          );
          // Fetch just this card
          const card = cards.find((c) => c.attemptId === newAttemptId);
          if (card?.studentId) {
            void fetchLatestSnapshot(card.studentId, card.attemptId).then((result) => {
              setCards((prev) =>
                prev.map((c) =>
                  c.attemptId === newAttemptId
                    ? { ...c, snapshotUrl: result?.url ?? c.snapshotUrl, capturedAt: result?.ts ?? c.capturedAt, loading: false }
                    : c
                )
              );
            });
          }
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [cards]);

  if (!cards.length) {
    return (
      <div className="empty-state">
        <i className="ti ti-camera-off" />
        No active candidates to monitor
      </div>
    );
  }

  return (
    <div className="candidate-grid">
      {cards.map((card) => (
        <CandidateCard key={card.attemptId} card={card} />
      ))}
    </div>
  );
}

// ── Single student card ────────────────────────────────────────────────────────
function CandidateCard({ card }: { card: CandidateCard }) {
  const color = integrityColor(card.score);

  return (
    <div className={`candidate-card ${card.score < 50 ? "card-flagged" : card.score < 70 ? "card-warning" : ""}`}>
      {/* Snapshot image */}
      <div className="candidate-snapshot">
        {card.loading ? (
          <div className="snapshot-skeleton skeleton" />
        ) : card.snapshotUrl ? (
          <img
            src={card.snapshotUrl}
            alt={`${card.name} webcam`}
            className="snapshot-img"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="snapshot-placeholder">
            <i className="ti ti-camera-off" />
            <span>No snapshot yet</span>
          </div>
        )}

        {/* Live indicator */}
        <div className="snapshot-live-dot" />

        {/* Integrity score overlay */}
        <div className="snapshot-score-badge" style={{ color }}>
          {card.score}%
        </div>
      </div>

      {/* Student info */}
      <div className="candidate-info">
        <div className="candidate-name">{card.name}</div>
        <div className="candidate-meta">
          {card.capturedAt
            ? `Updated ${relativeSeconds(card.capturedAt)}`
            : "Waiting for snapshot..."}
        </div>
      </div>
    </div>
  );
}

function relativeSeconds(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10)  return "just now";
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}