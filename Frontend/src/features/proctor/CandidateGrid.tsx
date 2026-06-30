/**
 * features/proctor/CandidateGrid.tsx
 *
 * Shows latest webcam snapshot for EVERY active student (not just flagged).
 * Refreshes every 30s + instantly via Supabase Realtime on new face log.
 *
 * Place at: Frontend/src/features/proctor/CandidateGrid.tsx
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import type { ActiveAttempt } from "./types";

interface CandidateGridProps {
  attempts: ActiveAttempt[];
  refreshMs?: number;
}

interface CandidateCard {
  attemptId:   string;
  studentId:   string;
  name:        string;
  snapshotUrl: string | null;
  capturedAt:  number | null;
  loading:     boolean;
}

const BUCKET          = "exam-snapshots";
const DEFAULT_REFRESH = 30_000;

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
  return {
    url: `${urlData.publicUrl}?t=${Date.now()}`,
    ts:  file.updated_at ? new Date(file.updated_at).getTime() : Date.now(),
  };
}

function relativeSeconds(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10)   return "just now";
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function CandidateGrid({
  attempts,
  refreshMs = DEFAULT_REFRESH,
}: CandidateGridProps) {
  const [cards, setCards] = useState<CandidateCard[]>([]);

  // Build card list whenever attempts changes
  useEffect(() => {
    if (!attempts.length) { setCards([]); return; }
    setCards(
      attempts.map((a) => ({
        attemptId:   a.id,
        studentId:   a.student_id,
        name:        a.users?.full_name ?? "Student",
        snapshotUrl: null,
        capturedAt:  null,
        loading:     true,
      }))
    );
  }, [attempts]);

  // Fetch all snapshots
  const refreshAll = useCallback(async (currentCards: CandidateCard[]) => {
    if (!currentCards.length) return;
    const updates = await Promise.all(
      currentCards.map(async (card) => {
        try {
          const result = await fetchLatestSnapshot(card.studentId, card.attemptId);
          return { ...card, snapshotUrl: result?.url ?? null, capturedAt: result?.ts ?? null, loading: false };
        } catch {
          return { ...card, loading: false };
        }
      })
    );
    setCards(updates);
  }, []);

  // Initial fetch + periodic refresh
  useEffect(() => {
    if (!cards.length) return;
    void refreshAll(cards);
    const timer = setInterval(() => {
      setCards((prev) => {
        void refreshAll(prev);
        return prev;
      });
    }, refreshMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length, refreshMs]);

  // Realtime: refresh just the affected card on new face log
  useEffect(() => {
    const ch = supabase
      .channel("candidate-grid-refresh")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "face_verification_logs" },
        (payload) => {
          const newAttemptId = (payload.new as Record<string, unknown>).attempt_id as string;
          setCards((prev) => {
            const card = prev.find((c) => c.attemptId === newAttemptId);
            if (!card) return prev;
            void fetchLatestSnapshot(card.studentId, card.attemptId).then((result) => {
              if (!result) return;
              setCards((p) =>
                p.map((c) =>
                  c.attemptId === newAttemptId
                    ? { ...c, snapshotUrl: result.url, capturedAt: result.ts, loading: false }
                    : c
                )
              );
            });
            return prev.map((c) => c.attemptId === newAttemptId ? { ...c, loading: true } : c);
          });
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  if (!attempts.length) {
    return (
      <div className="empty-state">
        <i className="ti ti-camera-off" />
        No active candidates — waiting for students to start
      </div>
    );
  }

  if (!cards.length) return null;

  return (
    <div className="candidate-grid">
      {cards.map((card) => (
        <SingleCard key={card.attemptId} card={card} />
      ))}
    </div>
  );
}

function SingleCard({ card }: { card: CandidateCard }) {
  return (
    <div className="candidate-card">
      <div className="candidate-snapshot">
        {card.loading ? (
          <div className="snapshot-skeleton skeleton" />
        ) : card.snapshotUrl ? (
          <img
            src={card.snapshotUrl}
            alt={`${card.name} webcam`}
            className="snapshot-img"
          />
        ) : (
          <div className="snapshot-placeholder">
            <i className="ti ti-camera-off" />
            <span>Waiting for snapshot…</span>
          </div>
        )}
        <div className="snapshot-live-dot" />
        {card.capturedAt && (
          <div className="snapshot-score-badge" style={{ color: "#4ade80" }}>
            {relativeSeconds(card.capturedAt)}
          </div>
        )}
      </div>
      <div className="candidate-info">
        <div className="candidate-name">{card.name}</div>
        <div className="candidate-meta">
          {card.capturedAt
            ? `Snapshot ${relativeSeconds(card.capturedAt)}`
            : card.loading
            ? "Loading snapshot…"
            : "No snapshot yet — exam just started"}
        </div>
      </div>
    </div>
  );
}