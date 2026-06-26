import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { proctorApi } from "../../features/proctor/api";
import type { ProctoringVerdict } from "./types";

const FLAGGED_KEY   = ["proctor-flagged"];
const DASHBOARD_KEY = ["proctor-dashboard"];

// ── Dashboard (profile + stats + flagged + active session) ───────────────────
export function useProctorDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn:  () => proctorApi.dashboard(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ── Flagged attempts + Supabase Realtime auto-refresh ────────────────────────
export function useFlaggedAttempts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: FLAGGED_KEY,
    queryFn:  () => proctorApi.flagged(),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    // Refresh flagged list whenever any proctoring table gets new rows
    const channel = supabase
      .channel("proctor-flagged-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "proctoring_summary" },
        () => {
          void queryClient.invalidateQueries({ queryKey: FLAGGED_KEY });
          void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "face_verification_logs" },
        () => void queryClient.invalidateQueries({ queryKey: FLAGGED_KEY })
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audio_monitoring_logs" },
        () => void queryClient.invalidateQueries({ queryKey: FLAGGED_KEY })
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

// ── Set proctor verdict ──────────────────────────────────────────────────────
export function useSetVerdict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      verdict,
      flagged,
    }: {
      attemptId: string;
      verdict: ProctoringVerdict;
      flagged?: boolean;
    }) =>
      proctorApi.setVerdict(attemptId, {
        proctor_verdict:   verdict,
        flagged_for_review: flagged,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FLAGGED_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}