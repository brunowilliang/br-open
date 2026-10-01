import { Button } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { VariantSection, noop } from "@/components/pages/settings/shared";
import { buildPlayerAgreementCard } from "@/components/pages/tournaments/match-agreement-provider";
import { BlockCourtDialog } from "@/components/pages/tournaments/block-court-dialog";
import { CancelMatchesDialog } from "@/components/pages/tournaments/cancel-matches-dialog";
import { MatchCard } from "@/components/ui/match-card";
import { ScheduleProposalDialog } from "@/components/ui/schedule-proposal-dialog";
import { ScoreResultDialog } from "@/components/ui/score-result-dialog";
import {
  MATCH_AGREEMENT_GALLERY_CASES,
  MATCH_AGREEMENT_GALLERY_COURTS,
  MATCH_AGREEMENT_GALLERY_DURATION_MINUTES,
  type MatchAgreementGalleryCase,
} from "@/lib/dev/match-agreement-gallery-fixtures";
import type { ScoreSet } from "@/lib/matches/score-display";
import { MATCH_AGREEMENT_MESSAGE } from "@/lib/tournaments/match-agreement-copy";
import {
  readMatchAgreementActionLabel,
  type MatchAgreementActionKind,
} from "@/lib/tournaments/match-agreement-actions";
import { resolveTableWalkoverWinnerEntryId } from "@/lib/tournaments/match-agreement-view";
import {
  bindOrganizerMatchMenu,
  buildOrganizerMatchMenu,
} from "@/lib/tournaments/organizer-match-menu";

/**
 * O card de partida é UM componente para as três superfícies da agenda (liga,
 * torneio e o "Próximo jogo" da casa do torneio) e para o chaveamento. A
 * galeria mostra o card por ESTADO: duplas e simples, com e sem resultado,
 * W.O., encerrado, agendado, a definir, a troca de oponente e os casos do nó —
 * menu do organizador, vaga vazia sem chip (em duplas e em simples) e a final
 * decidida com Campeão.
 */
const galleryMatchCardCases: {
  challengedDefined?: boolean;
  challengedName: string;
  challengedPartnerName?: null | string;
  challengerDefined?: boolean;
  challengerName: string;
  challengerPartnerName?: null | string;
  courtName: string;
  id: string;
  /** A vaga acima da 1ª rodada que espera os vencedores (caso do "Reservar
   * horário"). */
  canReserveSlot?: boolean;
  /** A pendência de concluir o torneio está viva e o caso é a FINAL. */
  conclusionPending?: boolean;
  /** Card marcado no modo seleção da agenda (borda accent). */
  isSelected?: boolean;
  matchDate?: null | string;
  matchStatus?: null | string;
  /** O card entra com o menu do ORGANIZADOR (o mesmo builder de todas as
   * telas). */
  menuActions?: boolean;
  /** Modalidade do caso, como a tela do chaveamento manda: a vaga em aberto não
   * tem parceiro para denunciar que a partida é de duplas. */
  modality?: "doubles" | "singles";
  /** Caso do NÓ: sai na largura da chave (320 pt, `CARD_WIDTH` do bracket). */
  nodeWidth?: boolean;
  note: string;
  scoreSets?: null | ScoreSet[];
  /** Modo seleção da agenda: o card ganha a superfície de toque (toque longo e
   * toque de marcação), como a tela o monta. */
  selectable?: boolean;
  selectedSide?: "a" | "b" | null;
  stageLabel?: null | string;
  startMinute: number;
  swapPickEnabled?: { a: boolean; b: boolean };
  title: string;
  walkoverWinner?: "a" | "b" | null;
}[] = [
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "duplas-encerrado",
    matchDate: "2026-09-12",
    matchStatus: "finished",
    modality: "doubles",
    note: "Cada número carrega a cor do SEU set (vencedor em accent, perdedor em muted, tie-break incluído) e os nomes carregam a cor e o peso do PAR (vencedor em accent e semibold, perdedor em muted e normal).",
    scoreSets: [
      { aGames: 6, bGames: 4, kind: "set" },
      { aGames: 3, bGames: 6, kind: "set" },
      {
        aGames: 7,
        bGames: 6,
        kind: "set",
        tieBreak: { aPoints: 7, bPoints: 5 },
      },
    ],
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 1 | duplas | encerrado com resultado",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "duplas-agendado",
    matchDate: "2026-09-12",
    matchStatus: "scheduled",
    modality: "doubles",
    note: "Agendado: cada ponta é uma dupla (dois avatares e um nome por linha) e o ponto do resultado não é desenhado.",
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 2 | duplas | agendado",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "duplas-wo",
    matchDate: "2026-09-12",
    matchStatus: "finished",
    modality: "doubles",
    note: "W.O. jogado: o vencedor por decisão (lado B) sai em accent e semibold e o perdedor em muted e normal, sem placar — o 0x0 do set placeholder não é resultado. O chip do topo é o W.O. do vocabulário mesmo com o status `finished` do wire.",
    scoreSets: [{ aGames: 0, bGames: 0, kind: "set" }],
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 3 | duplas | W.O.",
    walkoverWinner: "b",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "duplas-wo-sem-vencedor",
    matchDate: "2026-09-12",
    matchStatus: "walkover",
    modality: "doubles",
    note: "W.O. sem vencedor no wire (o shape da agenda da liga): o status `walkover` já dá o chip W.O. e o card não desenha placar nenhum — nem o 0x0 do placeholder — e não pinta lado, porque o item do `listScheduled` não carrega o vencedor.",
    scoreSets: [{ aGames: 0, bGames: 0, kind: "set" }],
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 3b | duplas | W.O. sem vencedor no wire",
  },
  {
    challengedName: "Ana Beatriz Cardoso",
    challengerName: "Marina Costa",
    courtName: "Quadra Central",
    id: "simples-encerrado",
    matchDate: "2026-09-13",
    matchStatus: "finished",
    modality: "singles",
    note: "Simples: sem parceiro a ponta fica com UM avatar e UM nome, e o resultado segue por set.",
    scoreSets: [
      { aGames: 6, bGames: 4, kind: "set" },
      { aGames: 6, bGames: 3, kind: "set" },
    ],
    stageLabel: "Final",
    startMinute: 1080,
    title: "Partida 4 | simples | encerrado com resultado",
  },
  {
    challengedName: "Ana Beatriz Cardoso",
    challengerName: "Marina Costa",
    courtName: "Quadra Central",
    id: "simples-agendado",
    matchDate: "2026-09-13",
    matchStatus: "scheduled",
    modality: "singles",
    note: "Simples agendado: um avatar e um nome por ponta, sem resultado.",
    stageLabel: "Final",
    startMinute: 1080,
    title: "Partida 5 | simples | agendado",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "",
    id: "a-definir",
    matchStatus: "pending",
    modality: "doubles",
    note: "A definir: sem dia (nem quadra) o chip de agendamento não aparece e o status do topo fica em A definir.",
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 6 | duplas | a definir (sem chip de agendamento)",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "troca-de-oponente",
    matchDate: "2026-09-12",
    matchStatus: "scheduled",
    modality: "doubles",
    nodeWidth: true,
    note: "Troca de oponente (chave): a seta aparece no lado habilitado pela tela e o lado armado fica com o fundo accent-soft; o toque no lado sobe pro dono da tela.",
    selectedSide: "a",
    stageLabel: "Quartas de final",
    startMinute: 840,
    swapPickEnabled: { a: true, b: true },
    title: "Partida 7 | troca de oponente armada (chave)",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "chave-menu-organizador",
    matchDate: "2026-09-12",
    matchStatus: "scheduled",
    menuActions: true,
    modality: "doubles",
    nodeWidth: true,
    note: "Menu do organizador no nó da chave, com os dois lados preenchidos: Agendar e Resultado. O menu é do CARD e só é desenhado onde há ação — no Próximo jogo nenhum card mostra menu.",
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 8 | chave | menu do organizador (Agendar + Resultado)",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "chave-menu-editar",
    matchDate: "2026-09-12",
    matchStatus: "finished",
    menuActions: true,
    modality: "doubles",
    nodeWidth: true,
    note: "Partida encerrada: o menu troca de ação e fica só com Editar resultado — é o placar já publicado que dá para mudar.",
    scoreSets: [
      { aGames: 6, bGames: 4, kind: "set" },
      { aGames: 6, bGames: 3, kind: "set" },
    ],
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 9 | chave | menu do organizador (Editar resultado)",
  },
  {
    challengedName: "Marina Costa",
    challengerDefined: false,
    challengerName: "A definir",
    courtName: "",
    id: "chave-vaga-vazia",
    matchStatus: "vacant",
    modality: "doubles",
    nodeWidth: true,
    note: "Duplas com o adversário A DEFINIR: vaga podada do sorteio (não desenha chip de status, que não é um jogo e sim a moldura da chave) e o lado sem inscrição sai com os DOIS avatares em black e UMA linha A definir em muted, porque a dupla é uma unidade. No nó, a vaga bye é o retângulo vazio do grafo, sem card nenhum.",
    stageLabel: "Quartas de final",
    startMinute: 840,
    title:
      "Partida 10 | chave | duplas | adversário a definir (vaga vazia sem chip)",
  },
  {
    challengedName: "Ana Beatriz Cardoso",
    challengerName: "Marina Costa",
    courtName: "Quadra Central",
    id: "chave-campeao",
    matchDate: "2026-09-13",
    matchStatus: "champion",
    modality: "singles",
    nodeWidth: true,
    note: "Final decidida: o chip do topo vira Campeão, em success. Quem sabe que é a final é a tela (o status do wire é 'finished', igual ao de qualquer partida encerrada).",
    stageLabel: "Final",
    startMinute: 1080,
    title: "Partida 11 | chave | final decidida com Campeão",
  },
  {
    challengedDefined: false,
    challengedName: "A definir",
    challengerName: "Marina Costa",
    courtName: "",
    id: "simples-vaga-vazia",
    matchStatus: "pending",
    modality: "singles",
    note: "Contraprova da Partida 10 em simples: o mesmo adversário em aberto sai com UM avatar black e UMA linha A definir em muted. Quem decide a forma do lado é a modalidade, e o indefinido é sinal do caller, nunca o texto do nome.",
    stageLabel: "Final",
    startMinute: 1080,
    title: "Partida 12 | simples | adversário a definir",
  },
  {
    challengedName: "Marina Costa",
    challengedPartnerName: "Diego Nakamura Alves",
    challengerName: "Bruno William Garcia",
    challengerPartnerName: "Rafael de Souza Lima",
    courtName: "Quadra 2",
    id: "agenda-selecionado",
    isSelected: true,
    matchDate: "2026-09-12",
    matchStatus: "scheduled",
    menuActions: true,
    modality: "doubles",
    note: "Modo seleção da agenda: o toque longo entra na seleção, o card marcado ganha a borda accent e o topo da tela vira Cancelar jogos. O menu do card segue ali, com o Cancelar jogo por último.",
    selectable: true,
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 13 | agenda | selecionado no modo seleção",
  },
  {
    canReserveSlot: true,
    challengedDefined: false,
    challengedName: "A definir",
    challengerDefined: false,
    challengerName: "A definir",
    courtName: "",
    id: "chave-reservar-horario",
    matchStatus: "pending",
    menuActions: true,
    modality: "singles",
    nodeWidth: true,
    note: "Semifinal que espera os vencedores: o organizador reserva dia, horário e quadra com o MESMO agendamento, e o item se chama Reservar horário. O menu não muda de tela para tela.",
    stageLabel: "Semifinal",
    startMinute: 840,
    title:
      "Partida 14 | chave | vaga que espera os vencedores (Reservar horário)",
  },
  {
    challengedName: "Jose Almeida Prado",
    challengerName: "Bruno William Garcia",
    conclusionPending: true,
    courtName: "Quadra Central",
    id: "chave-concluir",
    matchDate: "2026-09-13",
    matchStatus: "finished",
    menuActions: true,
    modality: "singles",
    nodeWidth: true,
    note: "Final decidida com a pendência de conclusão viva: Concluir torneio vem PRIMEIRO (é o ato do torneio) e Editar resultado fecha o menu.",
    scoreSets: [
      { aGames: 6, bGames: 4, kind: "set" },
      { aGames: 6, bGames: 3, kind: "set" },
    ],
    stageLabel: "Final",
    startMinute: 1080,
    title: "Partida 15 | chave | final decidida com a pendência de concluir",
  },
];

export function MatchCardVariantsSection() {
  const [request, setRequest] = useState<null | {
    action: MatchAgreementActionKind;
    galleryCase: MatchAgreementGalleryCase;
  }>(null);
  const [cancelDialogCount, setCancelDialogCount] = useState<null | number>(
    null
  );
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const galleryCase = request?.galleryCase ?? null;
  const scheduleProposal =
    galleryCase?.playerMatch.agreements.schedule.proposal ?? null;
  const scoreProposal =
    galleryCase?.playerMatch.agreements.score.proposal ?? null;
  const actionLabel = request
    ? readMatchAgreementActionLabel(request.action)
    : "";
  const isScheduleAction =
    request?.action === "propose_schedule" ||
    request?.action === "counter_schedule";
  const close = () => {
    setRequest(null);
  };

  return (
    <View className="gap-6">
      {galleryMatchCardCases.map((item) => (
        <VariantSection key={item.id} note={item.note} title={item.title}>
          {/* Largura do nó do chaveamento (CARD_WIDTH = 320 no bracket). */}
          <View className={item.nodeWidth ? "w-80" : undefined}>
            <MatchCard
              challengedDefined={item.challengedDefined}
              challengedName={item.challengedName}
              challengedPartnerName={item.challengedPartnerName}
              challengerDefined={item.challengerDefined}
              challengerName={item.challengerName}
              challengerPartnerName={item.challengerPartnerName}
              courtName={item.courtName}
              isSelected={item.isSelected}
              matchDate={item.matchDate}
              matchStatus={item.matchStatus}
              menu={
                item.menuActions
                  ? bindOrganizerMatchMenu({
                      entries: buildOrganizerMatchMenu({
                        canReserveSlot: item.canReserveSlot === true,
                        isConclusionPending: item.conclusionPending === true,
                        isFinal: item.conclusionPending === true,
                        isTournamentClosed: false,
                        matchDate: item.matchDate ?? null,
                        matchStatus: item.matchStatus ?? "pending",
                        sidesDefined:
                          (item.challengerDefined ?? true) &&
                          (item.challengedDefined ?? true),
                      }),
                      onAction: noop,
                    })
                  : undefined
              }
              modality={item.modality}
              onCardLongPress={item.selectable ? noop : undefined}
              onCardPress={item.selectable ? noop : undefined}
              scoreSets={item.scoreSets}
              selectedSide={item.selectedSide}
              stageLabel={item.stageLabel}
              startMinute={item.startMinute}
              swapPickEnabled={item.swapPickEnabled}
              walkoverWinner={item.walkoverWinner}
            />
          </View>
        </VariantSection>
      ))}

      {/* O combinado é um ESTADO deste mesmo card: chip no topo, menu de
          aprovar/editar no ⋮ e a proposta no rodapé de agendamento. */}
      {MATCH_AGREEMENT_GALLERY_CASES.map((item, index) => (
        <VariantSection key={item.id} note={item.note} title={item.title}>
          <MatchCard
            {...item.card}
            agreement={buildPlayerAgreementCard({
              courts: MATCH_AGREEMENT_GALLERY_COURTS,
              isMatchLocked: item.isMatchLocked,
              playerMatch: item.playerMatch,
              runAction: (nextAction) => {
                setRequest({ action: nextAction.action, galleryCase: item });
              },
              sideOrder: "match",
              tournamentStatus: item.tournamentStatus,
            })}
            isMenuDefaultOpen={index === 0}
          />
        </VariantSection>
      ))}

      {request && isScheduleAction ? (
        <ScheduleProposalDialog
          actionLabel={actionLabel}
          courts={MATCH_AGREEMENT_GALLERY_COURTS}
          defaultDurationMinutes={MATCH_AGREEMENT_GALLERY_DURATION_MINUTES}
          description={MATCH_AGREEMENT_MESSAGE.scheduleDialogDescription({
            sides: `${request.galleryCase.card.challengerName} contra ${request.galleryCase.card.challengedName}`,
          })}
          initialValue={
            scheduleProposal
              ? {
                  courtId: scheduleProposal.courtId ?? null,
                  endMinute:
                    scheduleProposal.startMinute +
                    MATCH_AGREEMENT_GALLERY_DURATION_MINUTES,
                  matchDate: scheduleProposal.matchDate,
                  startMinute: scheduleProposal.startMinute,
                }
              : undefined
          }
          isOpen
          occupiedSlots={[]}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              close();
            }
          }}
          onSubmit={close}
          slotIdToIgnore={request.galleryCase.playerMatch.match.id}
          title={actionLabel}
          unavailabilityBlocks={[]}
          unchangedMessage={MATCH_AGREEMENT_MESSAGE.sameScheduleProposal}
        />
      ) : null}

      {request && !isScheduleAction ? (
        <ScoreResultDialog
          actionLabel={actionLabel}
          initialSets={scoreProposal?.score.sets}
          initialWalkoverWinnerId={
            galleryCase
              ? resolveTableWalkoverWinnerEntryId(galleryCase.playerMatch)
              : null
          }
          isOpen
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              close();
            }
          }}
          onSubmit={close}
          sideAId={request.galleryCase.playerMatch.match.entryAId ?? ""}
          sideAName={request.galleryCase.card.challengerName}
          sideBId={request.galleryCase.playerMatch.match.entryBId ?? ""}
          sideBName={request.galleryCase.card.challengedName}
          title={actionLabel}
          unchangedMessage={MATCH_AGREEMENT_MESSAGE.sameScoreProposal}
          unchangedWalkoverMessage={
            MATCH_AGREEMENT_MESSAGE.sameWalkoverProposal
          }
          walkoverEnabled
        />
      ) : null}

      <VariantSection
        note="Diálogo único do cancelamento: motivo pronto (ou escrito) e o check que fecha o MESMO período dos jogos cancelados. O check vem ligado; o lote muda a copy e o botão."
        title="Diálogo | Cancelar jogo (um) e Cancelar jogos (lote)"
      >
        <View className="flex-row gap-2">
          <Button
            onPress={() => {
              setCancelDialogCount(1);
            }}
            size="sm"
          >
            <Button.Label>Um jogo</Button.Label>
          </Button>
          <Button
            onPress={() => {
              setCancelDialogCount(3);
            }}
            size="sm"
            variant="secondary"
          >
            <Button.Label>Lote de três</Button.Label>
          </Button>
        </View>
      </VariantSection>

      <VariantSection
        note="Fechar quadra: dia, período (ou o dia todo) de UMA quadra ou de todas. A lista de bloqueios do dia, na agenda, reabre pelo mesmo motivo."
        title="Diálogo | Fechar quadra"
      >
        <Button
          onPress={() => {
            setIsBlockDialogOpen(true);
          }}
          size="sm"
        >
          <Button.Label>Abrir fechar quadra</Button.Label>
        </Button>
      </VariantSection>

      {cancelDialogCount === null ? null : (
        <CancelMatchesDialog
          isPending={false}
          matchCount={cancelDialogCount}
          onClose={() => {
            setCancelDialogCount(null);
          }}
          onSubmit={() => {
            setCancelDialogCount(null);
          }}
          spans={[
            { date: "2026-09-12", endMinute: 1200, startMinute: 960 },
            { date: "2026-09-13", endMinute: 720, startMinute: 600 },
          ].slice(0, cancelDialogCount === 1 ? 1 : 2)}
        />
      )}

      {isBlockDialogOpen ? (
        <BlockCourtDialog
          courts={MATCH_AGREEMENT_GALLERY_COURTS}
          isPending={false}
          onClose={() => {
            setIsBlockDialogOpen(false);
          }}
          onSubmit={() => {
            setIsBlockDialogOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
