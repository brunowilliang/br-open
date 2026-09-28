import { Card } from "heroui-native";
import { useMemo } from "react";
import { View } from "react-native";

import { MatchCard, type MatchCardAgreement } from "@/components/ui/match-card";
import { BRACKET_BYE_CARD_HEIGHT } from "@/lib/tournaments/bracket-tree";
import {
  bindOrganizerMatchMenu,
  buildOrganizerMatchMenu,
  type OrganizerMatchMenuKind,
} from "@/lib/tournaments/organizer-match-menu";
import {
  isByeMatch,
  type BracketSwapTarget,
  type TournamentMatchWithSides,
} from "@/lib/tournaments/bracket-view";
import {
  formatEntryPlayerNames,
  walkoverWinnerSide,
} from "@/lib/tournaments/tournament-details-derived";

type BracketMatchCardProps = {
  /** Acerto do confronto: só o card de quem JOGA o recebe (o organizador segue
   * com o menu dele). */
  agreement?: MatchCardAgreement | null;
  courtName: null | string;
  /** Estrutura que a RESERVA exige (acima da 1ª rodada com as duas filhas na
   * chave): quem combina com organizador/torneio aberto/lados ausentes é o card. */
  canReserveSlot: boolean;
  isFinal: boolean;
  /** A pendência do organizador de concluir o torneio está viva (toda categoria
   * com campeão): só a FINAL oferece o item, e o menu dela é do torneio. */
  isConclusionPending: boolean;
  isOrganizer: boolean;
  /** Torneio encerrado ou cancelado: o servidor recusa toda ação de partida, e
   * o nó nasce sem menu nenhum. */
  isTournamentClosed: boolean;
  match: TournamentMatchWithSides;
  modality?: "doubles" | "singles";
  onHeightChange: (height: number) => void;
  /** Canal do menu do papel: o card monta o menu com o builder (fonte única) e
   * o verbo volta pelo mesmo fio que a agenda usa. */
  onMenuAction: (kind: OrganizerMatchMenuKind) => void;
  onSidePress: (target: BracketSwapTarget) => void;
  selectedSide: "a" | "b" | null;
  stageLabel: string;
  swapDisabled: boolean;
  /** Por LADO: aceita a seleção corrente como origem (preenchido) ou destino. */
  swapPickEnabled: { a: boolean; b: boolean };
};

/** Casca do NÓ do chaveamento: mede a altura (o grafo usa a medida) e trata a
 * vaga bye; o jogo em si é o MESMO card das telas (`ui/match-card.tsx`), com o
 * menu do organizador só onde há ação (torneio aberto e os dois lados
 * preenchidos). */
export function BracketMatchCard({
  agreement,
  canReserveSlot,
  courtName,
  isConclusionPending,
  isFinal,
  isOrganizer,
  isTournamentClosed,
  match,
  modality,
  onHeightChange,
  onMenuAction,
  onSidePress,
  selectedSide,
  stageLabel,
  swapDisabled,
  swapPickEnabled,
}: BracketMatchCardProps) {
  // A FINAL decidida fala "Campeão" pelo vocabulário do chip (o status do wire
  // não distingue a final); a vaga podada é a única que não desenha chip.
  const matchStatus =
    isFinal && match.winnerEntryId !== null ? "champion" : match.status;
  const menu = useMemo(
    () =>
      isOrganizer
        ? bindOrganizerMatchMenu({
            entries: buildOrganizerMatchMenu({
              canReserveSlot,
              isConclusionPending,
              isFinal,
              isTournamentClosed,
              matchDate: match.matchDate,
              matchStatus,
              sidesDefined: match.entryAId !== null && match.entryBId !== null,
            }),
            onAction: onMenuAction,
          })
        : [],
    [
      canReserveSlot,
      isConclusionPending,
      isFinal,
      isOrganizer,
      isTournamentClosed,
      match.entryAId,
      match.entryBId,
      match.matchDate,
      matchStatus,
      onMenuAction,
    ]
  );

  // Vaga DERIVADA do sorteio (bye): o card existe VAZIO — nenhum filho, sem
  // fase, sem chip (o "W.O." leria como W.O. jogado e o "A definir" como
  // adversário que não existe), sem lado fantasma, sem seta e sem identidade.
  // O W.O. JOGADO de verdade é `finished` com `walkover: true` e cai no card
  // normal (isByeMatch). O container do card e a altura FIXA na constante do
  // layout ficam: o retângulo do grafo casa com o render por construção e a
  // âncora do conector não se move (a rota sai cedo no onHeightChange do bye).
  if (isByeMatch(match)) {
    return (
      <View
        onLayout={(event) => {
          onHeightChange(event.nativeEvent.layout.height);
        }}
      >
        <Card
          className="w-full justify-center rounded-2xl p-2"
          style={{ height: BRACKET_BYE_CARD_HEIGHT }}
        />
      </View>
    );
  }

  const sideANames = formatEntryPlayerNames(match.entryA);
  const sideBNames = formatEntryPlayerNames(match.entryB);
  // A regra de quem pode ser origem ou destino mora na tela (bracket.tsx, via o
  // modelo puro de bracket-view): aqui só a apresentação do que ela decidiu,
  // LADO a LADO. Lado bloqueado não mostra a seta de troca.
  const swapEnabled = isOrganizer && !swapDisabled;
  const walkoverWinner = walkoverWinnerSide(match);

  return (
    <View
      onLayout={(event) => {
        onHeightChange(event.nativeEvent.layout.height);
      }}
    >
      <MatchCard
        agreement={agreement}
        challengedAvatarUrl={match.entryB?.playerA?.avatarUrl ?? null}
        challengedDefined={match.entryB !== null}
        challengedName={sideBNames[0]}
        challengedPartnerAvatarUrl={match.entryB?.playerB?.avatarUrl ?? null}
        challengedPartnerName={sideBNames[1] ?? null}
        challengerAvatarUrl={match.entryA?.playerA?.avatarUrl ?? null}
        challengerDefined={match.entryA !== null}
        challengerName={sideANames[0]}
        challengerPartnerAvatarUrl={match.entryA?.playerB?.avatarUrl ?? null}
        challengerPartnerName={sideANames[1] ?? null}
        courtName={courtName ?? ""}
        matchDate={match.matchDate}
        matchStatus={matchStatus}
        menu={menu}
        modality={modality}
        onSidePress={(side) => {
          onSidePress({ match, side });
        }}
        scoreSets={match.score?.sets ?? null}
        selectedSide={selectedSide}
        stageLabel={stageLabel}
        startMinute={match.startMinute ?? 0}
        swapPickEnabled={{
          a: swapEnabled && swapPickEnabled.a,
          b: swapEnabled && swapPickEnabled.b,
        }}
        walkoverWinner={walkoverWinner}
      />
    </View>
  );
}
