import { useQuery } from "@tanstack/react-query";
import { candidateApi, type CandidateExamState } from "./api";

export const CANDIDATE_QUERY_KEYS = {
  examState: ["candidate", "exam-state"] as const,
};

/**
 * Polls the candidate exam state every 30 seconds.
 * The state machine is: NOT_STARTED → ACTIVE → IN_PROGRESS → SUBMITTED
 *                         or EXPIRED / NO_EXAM at any point.
 */
export function useCandidateExamState() {
  return useQuery<CandidateExamState>({
    queryKey: CANDIDATE_QUERY_KEYS.examState,
    queryFn: candidateApi.examState,
    refetchInterval: 30_000,   // re-check every 30s (catches NOT_STARTED → ACTIVE transition)
    retry: 2,
    staleTime: 10_000,
  });
}
