type ScheduleSlot = {
  courtId: null | string;
  matchDate: string;
  startMinute: number;
};

/** Mesmo slot (data + quadra + início): o diálogo de propor outro horário recusa
 * reenviar o que já está na mesa. A janela fecha junto, porque a duração é a
 * mesma nos dois lados. */
export function isSameScheduleSlot(current: ScheduleSlot, next: ScheduleSlot) {
  return (
    current.matchDate === next.matchDate &&
    current.startMinute === next.startMinute &&
    (current.courtId ?? "") === (next.courtId ?? "")
  );
}
