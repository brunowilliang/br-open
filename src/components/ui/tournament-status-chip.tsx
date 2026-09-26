import { Chip } from "heroui-native";

import { getTournamentStatusChip } from "@/lib/tournaments/tournament-details-derived";

type TournamentStatusChipProps = {
  registrationDeadlineAt: number;
  status: string;
};

/** O estado do torneio no mesmo chip onde ele aparece: card da competição e
 *  banner do torneio (o rótulo e a cor saem da derivada). */
export const TournamentStatusChip = (props: TournamentStatusChipProps) => {
  // A janela de inscrição é do relógio: cada render relê o horário local.
  const chip = getTournamentStatusChip({
    nowMs: Date.now(),
    registrationDeadlineMs: props.registrationDeadlineAt,
    status: props.status,
  });

  return (
    <Chip color={chip.color} size="sm" variant="primary">
      <Chip.Label numberOfLines={1}>{chip.label}</Chip.Label>
    </Chip>
  );
};
