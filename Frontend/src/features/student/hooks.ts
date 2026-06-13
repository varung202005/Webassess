import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "./api";

export const studentPortalKey = ["student", "portal"] as const;

export function useStudentPortal() {
  return useQuery({
    queryKey: studentPortalKey,
    queryFn: studentApi.portal,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function usePortalAction<TVariables>(
  action: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentPortalKey }),
  });
}
