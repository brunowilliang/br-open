import type { TournamentStatus } from "@convex/domains/tournament/contract";
import { Chip } from "heroui-native";
import { View } from "react-native";

import { VariantSection } from "@/components/pages/settings/shared";
import { CompetitionCard } from "@/components/ui/competition-card";
import { TournamentStatusChip } from "@/components/ui/tournament-status-chip";

// Data viva: com data fixa o rótulo viraria "encerradas" sozinho quando o dia
// chegasse.
const galleryTournamentNowMs = Date.now();
const GALLERY_DAY_MS = 24 * 60 * 60 * 1000;

const galleryTournamentStatusCases: {
  note: string;
  registrationDeadlineAt: number;
  status: TournamentStatus;
  title: string;
}[] = [
  {
    note: "Torneio criado e ainda não publicado: sem inscrição aberta e sem chave.",
    registrationDeadlineAt: galleryTournamentNowMs + GALLERY_DAY_MS * 10,
    status: "draft",
    title: "Estado 1 | rascunho",
  },
  {
    note: "Publicado dentro do prazo: é o estado em que a inscrição está aberta.",
    registrationDeadlineAt: galleryTournamentNowMs + GALLERY_DAY_MS * 3,
    status: "published",
    title: "Estado 2 | inscrições abertas",
  },
  {
    note: "Prazo vencido e torneio ainda não começou (sorteio feito ou não): quem fecha a inscrição é o prazo, nunca o sorteio.",
    registrationDeadlineAt: galleryTournamentNowMs - GALLERY_DAY_MS,
    status: "drawn",
    title: "Estado 3 | inscrições encerradas",
  },
  {
    note: "Chave em disputa. Fica com a mesma cor de inscrições encerradas, como o vocabulário aprovado.",
    registrationDeadlineAt: galleryTournamentNowMs - GALLERY_DAY_MS * 5,
    status: "ongoing",
    title: "Estado 4 | em andamento",
  },
  {
    note: "Todas as categorias com campeão.",
    registrationDeadlineAt: galleryTournamentNowMs - GALLERY_DAY_MS * 30,
    status: "finished",
    title: "Estado 5 | encerrado",
  },
  {
    note: "Cancelado pelo organizador antes do início.",
    registrationDeadlineAt: galleryTournamentNowMs + GALLERY_DAY_MS * 2,
    status: "cancelled",
    title: "Estado 6 | cancelado",
  },
];

export function TournamentStatusVariantsSection() {
  return (
    <View className="gap-6">
      {galleryTournamentStatusCases.map((item) => (
        <VariantSection key={item.status} note={item.note} title={item.title}>
          <View className="flex-row items-center">
            <TournamentStatusChip
              registrationDeadlineAt={item.registrationDeadlineAt}
              status={item.status}
            />
          </View>
        </VariantSection>
      ))}

      <VariantSection
        note="O estado entra ao lado do chip de Torneio, lendo primeiro a identidade e depois a situação."
        title="No header do torneio"
      >
        <View className="flex-row items-center gap-1.5">
          <Chip color="accent" size="sm" variant="soft">
            <Chip.Label>Torneio</Chip.Label>
          </Chip>
          <TournamentStatusChip
            registrationDeadlineAt={galleryTournamentNowMs + GALLERY_DAY_MS * 3}
            status="published"
          />
        </View>
      </VariantSection>

      <VariantSection
        note="No card os dois chips ficam empilhados no canto: a coluna do card (metade da tela) não cabe os dois na mesma linha."
        title="No card da competição"
      >
        {/* O card é `flex-1`: em coluna de altura automática ele mediria zero,
            a linha é o que dá altura. */}
        <View className="w-1/2 flex-row">
          <CompetitionCard
            chipLabel="Torneio"
            city="Campinas"
            name="Torneio de Verão do Círculo"
            registrationDeadlineAt={galleryTournamentNowMs + GALLERY_DAY_MS * 3}
            state="SP"
            status="published"
          />
        </View>
      </VariantSection>
    </View>
  );
}
