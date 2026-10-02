import { buildOrganizerConclusionPendings } from "@convex/domains/tournament/pendings-rules";
import { View } from "react-native";

import {
  LabeledBlock,
  NoticeMoldsVariants,
  VariantSection,
  noop,
} from "@/components/pages/settings/shared";
import {
  WidgetAlert,
  type WidgetAlertDescriptionPart,
} from "@/components/ui/widget-alert";
import { PENDING_ALERT_STATUS } from "@/lib/pendings/pendings-view";

/**
 * No máximo UM destaque por descrição, sempre a palavra que identifica a
 * pendência (nome, categoria, valor, prazo) — nunca número solto.
 */
const galleryInviteReceivedParts: WidgetAlertDescriptionPart[] = [
  { isHighlighted: true, text: "Marina Costa" },
  { text: " convidou você para jogar Duplas Mistas na Copa Dracena 8." },
];

const galleryInviteSentParts: WidgetAlertDescriptionPart[] = [
  { text: "Aguardando " },
  { isHighlighted: true, text: "Gustavo Lima" },
  { text: " aceitar o convite para Duplas Mistas na Copa Dracena 8." },
];
const galleryPaymentChargeOpenParts: WidgetAlertDescriptionPart[] = [
  { text: "Pague até " },
  { isHighlighted: true, text: "12 de set. de 2026" },
  { text: " para garantir sua vaga." },
];

const galleryPaymentChargeExpiredParts: WidgetAlertDescriptionPart[] = [
  { text: "O PIX de " },
  { isHighlighted: true, text: "R$ 40,00" },
  { text: " venceu sem pagamento." },
];

// Título, CTA e descrição da pendência de concluir vêm do builder REAL do
// servidor: a galeria não digita copy nenhuma deste cartão.
const galleryConclusionPendings = buildOrganizerConclusionPendings({
  tournaments: [
    {
      canConclude: true,
      tournamentId: "tournament-1",
      tournamentName: "Copa Dracena 8",
    },
  ],
});
const galleryConclusionPending = galleryConclusionPendings[0];

/**
 * Anatomia provada na doc bundled do heroui-native: Alert + Alert.Indicator +
 * Alert.Content, SEM slot de ações (a ação é um `Button`) e status default/
 * accent/success/warning/danger — NÃO existe `info`.
 */
export function AlertsVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection
        note="Título real da casa do torneio (pages/tournaments/player-overview.tsx:108-117, com o singular 1 inscrição aguardando pagamento na mesma linha). Hoje esse alerta só tem título: a descrição e o CTA são PROPOSTA, e o Pagar é o rótulo real do botão do card Suas inscrições (:213-222), já de uma palavra. Sem destaque: a frase não tem palavra-chave (o valor que decide a inscrição é dado que só o contrato manda) — apontado."
        title="Alerta 4 | REAL + descrição e ação propostas | Torneio (jogador): inscrição aguardando pagamento"
      >
        <WidgetAlert
          action={{ label: "Pagar", onPress: noop }}
          description="Confirme o pagamento para garantir sua vaga na chave."
          status="warning"
          title="2 inscrições aguardando pagamento"
        />
      </VariantSection>

      <VariantSection
        note="Título e status accent REAIS do item `player_tournament_partner_invite_received` do SERVIDOR (convex/domains/tournament/pendings-rules.ts:91-127; o alerta de título único que existia na casa do torneio saiu no cutover da Etapa 2 do PLN-0008); o pedido citava warning. A descrição diz QUEM convida, PARA QUE (categoria) e ONDE (competição), com o nome em negrito: a categoria usa o formato real do app (Duplas Mistas: convex/domains/tournament/entry-rules.ts:29-38). Só o NOME fica destacado porque a régua é um destaque por linha e o dado que ele precisa reconhecer para agir é quem chamou (a categoria e a competição disputam o mesmo destaque: apontado). As DUAS ações estão no RODAPÉ do alerta, dentro da superfície e na mesma linha, na ordem do molde do app: recusar (pages/tournaments/player-overview.tsx:169-179) antes de aceitar (:180-191), ou seja quem confirma fica por último. Rótulos de uma palavra."
        title="Alerta 5 | REAL + descrição e ações propostas | Torneio (jogador): convite de dupla recebido"
      >
        <WidgetAlert
          action={{ label: "Aceitar", onPress: noop }}
          description={[{ parts: galleryInviteReceivedParts }]}
          secondaryAction={{ label: "Recusar", onPress: noop }}
          status="accent"
          title="Convite de dupla aguardando sua resposta"
        />
      </VariantSection>

      <VariantSection
        note="Copy nova (hoje o estado só existe como chip Sem parceiro, lib/tournaments/tournament-details-derived.ts:104). A descrição traz o nome de quem foi convidado, a categoria e a competição, com o NOME em negrito (mesma régua do cartão 5: um destaque por linha e o dado que decide é de quem se espera resposta; categoria e competição ficam sem destaque: apontado). info = accent: o vocabulário do alerta não tem info (alert.md da versão instalada e ui/widget-alert.tsx:33)."
        title="Alerta 6 | PROPOSTA | Torneio (jogador): convite de dupla enviado"
      >
        <WidgetAlert
          description={[{ parts: galleryInviteSentParts }]}
          status="accent"
          title="Convite de dupla enviado"
        />
      </VariantSection>

      <VariantSection
        note="Copy nova (hoje o estado só existe como chip Em análise, lib/tournaments/tournament-details-derived.ts:103). Sem destaque: a frase não tem palavra-chave (nem nome, nem valor, nem prazo) — apontado. info = accent, mesmo motivo do cartão 6."
        title="Alerta 7 | PROPOSTA | Torneio (jogador): inscrição aguardando aprovação do organizador"
      >
        <WidgetAlert
          description="O organizador precisa liberar sua inscrição para você entrar na chave."
          status="accent"
          title="Inscrição aguardando aprovação"
        />
      </VariantSection>

      <VariantSection
        note="Título e CTA reais (pages/tournaments/organizer-overview.tsx:66-78), com o singular 1 inscrição aguardando aprovação na mesma linha e o Ver levando para Inscrições na aba Pendências. O status real é accent, o pedido citava warning. Descrição PROPOSTA: hoje este alerta só tem título. Sem destaque: a frase não tem palavra-chave (a lista de quem espera liberação é dado que só o contrato manda) — apontado."
        title="Alerta 11 | REAL + descrição proposta | Torneio (organizador): inscrições aguardando aprovação"
      >
        <WidgetAlert
          action={{ label: "Ver", onPress: noop }}
          description="Revise para liberar ou recusar quem entra na chave."
          status="accent"
          title="3 inscrições aguardando aprovação"
        />
      </VariantSection>

      <VariantSection
        note="Título e CTA reais (pages/tournaments/organizer-overview.tsx:80-93), mesmo destino do alerta anterior. Descrição PROPOSTA: hoje este alerta só tem título. Sem destaque: a frase não tem palavra-chave (sem valor, sem prazo e sem nome) — apontado."
        title="Alerta 12 | REAL + descrição proposta | Torneio (organizador): inscrições aguardando pagamento"
      >
        <WidgetAlert
          action={{ label: "Ver", onPress: noop }}
          description="A vaga entra na chave depois do pagamento confirmado."
          status="warning"
          title="2 inscrições aguardando pagamento"
        />
      </VariantSection>

      <VariantSection
        note="Copy nova, com DOIS apontamentos: sem placar não existe como estado hoje (a partida é A definir, Agendada, Encerrada ou W.O., lib/matches/match-display.ts:14-21) e nenhum aviso do app fala de confronto sem agendamento — não há texto real equivalente. Qual confronto conta como pendência ainda não tem regra. Sem destaque: falta a palavra-chave (qual rodada ou quadra está em aberto) — apontado. Sem CTA."
        title="Alerta 15 | PROPOSTA | Torneio (organizador): confronto sem agendamento"
      >
        <WidgetAlert
          description="A chave fica pronta para começar quando todos os confrontos estiverem agendados."
          status="warning"
          title="4 confrontos sem agendamento"
        />
      </VariantSection>

      <VariantSection
        note="PROPOSTA (não aprovada). Origem do dado: a inscrição de torneio com pagamento pendente e a cobrança da entry, PENDING no pendente e EXPIRED no vencido (payment.charge.getPendingCharge, o mesmo caminho do CTA Pagar da casa do torneio, tournaments/[tournamentId]/index.tsx:79-96). O contrato precisa mandar: kind novo de escopo player (ex.: player_payment_charge_open no pendente e player_payment_charge_expired no vencido), source {type: payment_charge, id} (TIPO NOVO de fonte: PENDING_SOURCE_TYPE_OPTIONS hoje não tem payment_charge, convex/domains/pendings/contract.ts:46-50) + sourceId/sourceType da cobrança para o CTA Pagar reabrir o checkout (destino vivo: /checkout/[chargeId], settings/player/payments.tsx:95-100), deadlineAt = expiração do PIX, moneyCents = valor da cobrança, domain payment, actionLabel Pagar (Renovar quando a vaga foi liberada). REGRA de severidade: warning no PENDING e no EXPIRED com a vaga ainda reservada; danger quando o prazo terminou e a vaga foi liberada. BURACO na v1: o estado awaiting_payment não gera item nenhum hoje (evidência: membership de DEV n97ef6kqw5fsgvc9ng0hrddg7s8b3avs), então o jogador que gerou o PIX e não pagou não tem aviso centralizado."
        title="Alerta 17 | PROPOSTA | Jogador: PIX pendente ou vencido"
      >
        <View className="gap-4">
          <LabeledBlock label="Pendente">
            <WidgetAlert
              action={{ label: "Pagar", onPress: noop }}
              description={[{ parts: galleryPaymentChargeOpenParts }]}
              status="warning"
              title="PIX aguardando pagamento"
            />
          </LabeledBlock>

          <LabeledBlock label="Vencido">
            <WidgetAlert
              action={{ label: "Pagar", onPress: noop }}
              description={[{ parts: galleryPaymentChargeExpiredParts }]}
              status="warning"
              title="PIX vencido"
            />
          </LabeledBlock>

          <LabeledBlock label="Vencido com a vaga liberada">
            <WidgetAlert
              action={{ label: "Renovar", onPress: noop }}
              description="O prazo terminou e sua vaga foi liberada."
              status="danger"
              title="PIX vencido"
            />
          </LabeledBlock>
        </View>
      </VariantSection>

      <VariantSection
        note="O GESTO que só as duas homes ligam (opt-in `isSwipeEnabled` + `dismissSurface` na superfície `home`): arraste o cartão para a esquerda — ou toque nele — e a ação revelada Esconder aparece animando; tocar nela aqui não executa nada (a galeria aprova, não executa: o handler é o noop). O sangramento usa o MESMO par das homes (o `px-4` do container desta galeria é o `mx-4` da página delas): container `-mx-4`, childrenContainer `mx-4` e ação `pr-4 -ml-1`. A copy é a real do servidor para a inscrição aguardando pagamento — o que este cartão amostra é o gesto; o resto da seção segue estático de propósito."
        title="Alerta 18 | GESTO | o swipe com a ação revelada Esconder"
      >
        <WidgetAlert
          action={{ label: "Pagar", onPress: noop }}
          description="Confirme o pagamento para garantir sua vaga na chave."
          dismissAction={{ onPress: noop }}
          isSwipeEnabled
          status="warning"
          swipeClassNames={{
            action: "pr-4 -ml-1",
            childrenContainer: "mx-4",
            container: "-mx-4",
          }}
          title="Pagamento atrasado"
        />
      </VariantSection>

      <VariantSection
        note="Item REAL do servidor (buildOrganizerConclusionPendings, convex/domains/tournament/pendings-rules.ts:337: nome, CTA e frase vêm da regra, nada digitado aqui). É o kind organization_tournament_awaiting_conclusion, o único SEM dispensa (PENDING_NON_DISMISSIBLE_KINDS): este cartão não tem gesto de esconder nem na home (o servidor recusaria) e sai da tela só quando o organizador conclui. O CTA roda tournament.lifecycle.conclude."
        title="Alerta 19 | REAL | Torneio (organizador): concluir torneio"
      >
        <WidgetAlert
          action={{
            label: galleryConclusionPending.actionLabel ?? "Concluir",
            onPress: noop,
          }}
          description={galleryConclusionPending.description}
          status={PENDING_ALERT_STATUS[galleryConclusionPending.severity]}
          title={galleryConclusionPending.title}
        />
      </VariantSection>

      <VariantSection
        note="REAL (tournaments/[tournamentId]/schedule.tsx:400-425): o alerta substituiu o chip do bloqueio na agenda. O título diz PERÍODO fechado, não o dia inteiro: o bloqueio pode ser só um pedaço do dia (o rótulo inteiro que existia antes afirmava o dia e dava impressão errada). A descrição é o rótulo do bloqueio montado a partir do contrato (lib/tournaments/unavailability-derived.ts): com hora, é a faixa (16:00 às 20:00); sem hora, o Dia todo. A ação Reabrir abre a confirmação Reabrir a agenda, que roda unavailability.remove. O jogador vê o MESMO alerta, sem botão (sem ação não há CTA no molde). Bloqueio TOTALMENTE coberto por outro (mesma quadra ou Todas as quadras, período dentro do outro) não vira alerta: a regra é selectVisibleUnavailabilityBlocks, lib/tournaments/unavailability-derived.ts."
        title="Alerta 20 | REAL | Agenda: período fechado (organizador com ação, jogador sem)"
      >
        <View className="gap-4">
          <LabeledBlock label="Organizador">
            <WidgetAlert
              action={{ label: "Reabrir", onPress: noop }}
              description="Chuva | Todas as quadras | 19:00 às 20:30"
              status="warning"
              title="Período fechado"
            />
          </LabeledBlock>

          <LabeledBlock label="Jogador">
            <WidgetAlert
              description="Chuva | Todas as quadras | 19:00 às 20:30"
              status="warning"
              title="Período fechado"
            />
          </LabeledBlock>

          <LabeledBlock label="Jogador, dia inteiro (sem hora no bloqueio)">
            <WidgetAlert
              description="Chuva | Todas as quadras | Dia todo"
              status="warning"
              title="Período fechado"
            />
          </LabeledBlock>
        </View>
      </VariantSection>

      <NoticeMoldsVariants />
    </View>
  );
}
