export function formatMinuteToHHMM(minute: number): string {
  const hour = Math.floor(minute / 60);
  const currentMinute = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
}

export function formatMsAsMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatSecondsAsMMSS(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
