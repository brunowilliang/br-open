import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const DEFAULT_COOLDOWN_SECONDS = 30;

export function useOtpCooldown(
  storageKey: string,
  cooldownSeconds = DEFAULT_COOLDOWN_SECONDS
) {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    async function loadPersistedCooldown() {
      const timestamp = await SecureStore.getItemAsync(storageKey);
      if (!timestamp) {
        return;
      }
      const elapsed = Math.floor((Date.now() - Number(timestamp)) / 1000);
      setCooldown(Math.max(0, cooldownSeconds - elapsed));
    }
    loadPersistedCooldown();
  }, [storageKey, cooldownSeconds]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function startCooldown() {
    setCooldown(cooldownSeconds);
    await SecureStore.setItemAsync(storageKey, Date.now().toString());
  }

  async function clearCooldown() {
    setCooldown(0);
    await SecureStore.deleteItemAsync(storageKey);
  }

  return { clearCooldown, cooldown, startCooldown };
}
