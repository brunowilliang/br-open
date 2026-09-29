import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { BRAZIL_UTC_OFFSET_MS } from "@convex/domains/payment/rules";
import { brazilDayKey } from "@convex/domains/tournament/window-rules";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Instante da próxima meia-noite do Brasil (03:00 UTC) depois de `nowMs`. */
export function resolveNextBrazilMidnightMs(nowMs: number): number {
  const shifted = nowMs + BRAZIL_UTC_OFFSET_MS;

  return (Math.floor(shifted / DAY_MS) + 1) * DAY_MS - BRAZIL_UTC_OFFSET_MS;
}

/**
 * O "hoje" do calendário do Brasil, vivo: recalcula no foco da tela, na volta
 * do app ao primeiro plano e na virada da meia-noite — o dia nunca fica preso
 * no valor de quando a tela montou.
 */
export function useBrazilTodayDayKey(): string {
  const [dayKey, setDayKey] = useState(() => brazilDayKey(Date.now()));

  const refresh = useCallback(() => {
    setDayKey(brazilDayKey(Date.now()));
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    let cancel: (() => void) | undefined;

    // Timer recursivo: o alvo é sempre a próxima meia-noite do Brasil, então a
    // virada reagenda sozinha mesmo quando o disparo chega adiantado.
    const schedule = () => {
      const delay = Math.max(
        1000,
        resolveNextBrazilMidnightMs(Date.now()) - Date.now() + 1000
      );
      const timer = setTimeout(() => {
        refresh();
        schedule();
      }, delay);

      cancel = () => clearTimeout(timer);
    };

    schedule();

    return () => {
      cancel?.();
    };
  }, [refresh]);

  return dayKey;
}
