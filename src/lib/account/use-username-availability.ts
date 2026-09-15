import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/convex/auth-client";
import {
  normalizeUsername,
  shouldCheckUsernameAvailability,
} from "./username-rules";

export type UsernameAvailabilityStatus =
  | "available"
  | "checking"
  | "idle"
  | "taken";

const USERNAME_AVAILABILITY_DEBOUNCE_MS = 500;

export function usernameAvailabilityQueryKey(username: string) {
  return ["auth", "username-available", username] as const;
}

/**
 * Checagem de disponibilidade do username em tempo real (endpoint nativo
 * `authClient.isUsernameAvailable`, POST /is-username-available), com debounce
 * de 500ms. Só consulta quando o formato é válido e o valor mudou em relação
 * ao username atual da conta; erro de rede fica "idle" (a validação real
 * acontece no submit via `authClient.updateUser`).
 */
export function useUsernameAvailability(input: {
  currentUsername: null | string | undefined;
  value: string;
}): UsernameAvailabilityStatus {
  const normalized = normalizeUsername(input.value ?? "");
  const shouldCheck = shouldCheckUsernameAvailability({
    currentUsername: input.currentUsername,
    value: input.value ?? "",
  });

  const [debounced, setDebounced] = useState(normalized);

  useEffect(() => {
    if (!shouldCheck) {
      setDebounced(normalized);
      return;
    }

    const timer = setTimeout(
      () => setDebounced(normalized),
      USERNAME_AVAILABILITY_DEBOUNCE_MS
    );

    return () => clearTimeout(timer);
  }, [normalized, shouldCheck]);

  const query = useQuery({
    enabled: shouldCheck && debounced === normalized,
    queryFn: async () => {
      const { data, error } = await authClient.isUsernameAvailable({
        username: debounced,
      });

      if (error) {
        throw error;
      }

      return data?.available ?? false;
    },
    queryKey: usernameAvailabilityQueryKey(debounced),
    staleTime: 30_000,
  });

  if (!shouldCheck) {
    return "idle";
  }

  if (query.isPending || query.isFetching || debounced !== normalized) {
    return "checking";
  }

  if (query.isError || query.data === undefined) {
    return "idle";
  }

  return query.data ? "available" : "taken";
}
