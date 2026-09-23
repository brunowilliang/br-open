import {
  Cancel01Icon,
  Clock02Icon,
  Tick02Icon,
  UserGroup02Icon,
} from "@hugeicons/core-free-icons";
import { useLocalSearchParams } from "expo-router";
import { Alert, Button, Surface } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { NotificationCard } from "@/components/notifications/notification-card";
import { EmptyState } from "@/components/ui/empty-state";
import { EntryCard } from "@/components/ui/entry-card";
import { HugeIcons } from "@/components/ui/huge-icons";
import {
  JoinFooter,
  type JoinFooterCategory,
  type JoinFooterPartnerOption,
} from "@/components/ui/join-footer";
import { KpiCard } from "@/components/ui/kpi-card";
import { MonthlyChartCard } from "@/components/ui/monthly-chart-card";
import { MatchCard } from "@/components/ui/match-card";
import {
  WidgetAlert,
  type WidgetAlertDescriptionLine,
  type WidgetAlertDescriptionPart,
} from "@/components/ui/widget-alert";
import { findComponentGalleryEntry } from "@/lib/dev/component-registry";
import {
  buildGalleryNotificationItem,
  buildGalleryNotificationNote,
  NOTIFICATION_GALLERY_EVENT_TYPES,
  NOTIFICATION_GALLERY_GROUPS,
  RENEWAL_REMINDER_DAYS_LEFT_VARIANTS,
} from "@/lib/dev/notification-gallery-fixtures";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildPlayerResultsChart } from "@/lib/home/player-dashboard-view";
import {
  buildNotificationMenuItems,
  type NotificationCardItem,
} from "@/lib/notifications/notification-view";
import type { BracketScoreSet } from "@/lib/tournaments/bracket-score-display";

/** Moldura de variante: título, conteúdo e a linha de procedência (`note`). */
function VariantSection(props: {
  children: ReactNode;
  note?: string;
  title: string;
}) {
  return (
    <View className="gap-1">
      <Text color="muted" variant="description" weight="medium">
        {props.title}
      </Text>
      {props.children}
      {props.note ? (
        <Text color="muted" variant="description">
          {props.note}
        </Text>
      ) : null}
    </View>
  );
}

function KpiVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection title="KPI 1 · normal">
        <KpiCard label="Ocupação" value="18 ativos" />
      </VariantSection>

      <VariantSection title="KPI 2 · com descrição">
        <KpiCard
          description="de 24 vagas"
          icon={UserGroup02Icon}
          label="Ocupação"
          value="18 ativos"
        />
      </VariantSection>

      <VariantSection title="KPI 3 · com erro">
        <KpiCard icon={Clock02Icon} label="Em atraso" tint="danger" value="3" />
      </VariantSection>

      <VariantSection title="KPI 4 · com diálogo">
        {/* InfoDialog INTERNO do KpiCard (prop `info` -> InfoTrigger +        */}
        {/* InfoDialog no próprio componente, ui/kpi-card.tsx). */}
        <KpiCard
          description="de 24 vagas"
          info={{
            description:
              "A ocupação conta apenas os membros ativos da liga hoje.",
            title: "Ocupação",
          }}
          label="Ocupação"
          value="18 ativos"
        />
      </VariantSection>
    </View>
  );
}

function TextVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection title="Texto 1 · título de tela">
        <Text variant="title">Configurações</Text>
      </VariantSection>

      <VariantSection title="Texto 2 · heading de seção">
        <Text variant="heading">Aviso importante</Text>
      </VariantSection>

      <VariantSection title="Texto 3 · corpo">
        <Text>
          Sua inscrição foi confirmada. Os horários das partidas aparecem na
          agenda da competição.
        </Text>
      </VariantSection>

      <VariantSection title="Texto 4 · descrição (secundário apagado)">
        <Text color="muted" variant="description">
          Push e central de notificações.
        </Text>
      </VariantSection>

      <VariantSection title="Texto 5 · rótulo concentrado">
        <Text variant="label">Modo de uso</Text>
      </VariantSection>

      <VariantSection title="Texto 6 · display">
        <Text variant="display">42</Text>
      </VariantSection>

      <VariantSection title="Texto 7 · valor de preço">
        <Text size="3xl" weight="semibold">
          {formatCurrencyCents(123_456)}
        </Text>
      </VariantSection>

      <VariantSection title="Texto 8 · ênfases semânticas">
        <View className="gap-1">
          <Text color="danger" variant="description">
            Cobrança expirada.
          </Text>
          <Text color="warning" variant="description">
            Faltam 3 dias para o vencimento.
          </Text>
          <Text color="success" variant="description">
            Pagamento confirmado.
          </Text>
          <Text color="accent" variant="description">
            Disponível na sua liga.
          </Text>
        </View>
      </VariantSection>

      <VariantSection title="Texto 9 · alinhamento centralizado (novo)">
        <Text align="center" color="muted" variant="description">
          Nenhum resultado encontrado.
        </Text>
      </VariantSection>
    </View>
  );
}

/**
 * O rodapé é absoluto (Page.Footer): cada caixa h-28 ancora a instância no pai
 * direto.
 */
const galleryPartnerOptions: JoinFooterPartnerOption[] = [
  { fullName: "Gustavo Lima", username: "gustavo.lima" },
  { fullName: "Marina Costa", username: "marina.costa" },
  { fullName: "Pedro Almeida", username: "pedro.almeida" },
  { fullName: "Rafael Souza", username: "rafa.souza" },
  { fullName: "Camila Ferraz", username: "camila.ferraz" },
];

function JoinFooterVariantsSection() {
  const tournamentCategories = [
    {
      displayName: "Masculino",
      id: "singles",
      modality: "singles",
      priceLabel: formatCurrencyCents(4000),
      vacancyLabel: "8 vagas",
    },
    {
      displayName: "Misto",
      id: "doubles",
      modality: "doubles",
      priceLabel: formatCurrencyCents(4000),
      vacancyLabel: "4 vagas",
    },
    {
      displayName: "Feminino",
      id: "feminino-singles",
      isFull: true,
      modality: "singles",
      priceLabel: formatCurrencyCents(4000),
    },
  ] satisfies JoinFooterCategory[];

  return (
    <View className="flex-1 justify-end gap-6">
      <VariantSection title="Inscrição 1 · liga (clique direto)">
        <View className="h-28">
          <JoinFooter
            actionLabel="Solicitar entrada"
            availabilityLabel="3 vagas disponíveis"
            price={{
              amount: formatCurrencyCents(4000),
              prefix: "a partir de",
              suffix: "/mês",
            }}
            title="Preço"
          />
        </View>
      </VariantSection>

      <VariantSection title="Inscrição 2 · torneio (abre o painel)">
        <View className="h-28">
          <JoinFooter
            actionLabel="Pagar R$ 40,00"
            categories={tournamentCategories}
            description="Escolha a categoria e confirme sua inscrição."
            partnerOptions={galleryPartnerOptions}
            price={{
              amount: formatCurrencyCents(4000),
              prefix: "a partir de",
            }}
            title="Inscreva-se"
          />
        </View>
      </VariantSection>

      <VariantSection title="Inscrição 3 · lotada (desabilitada)">
        <View className="h-28">
          <JoinFooter
            actionLabel="Solicitar entrada"
            isActionDisabled
            price={{
              amount: formatCurrencyCents(4000),
              prefix: "a partir de",
              suffix: "/mês",
            }}
            title="Preço"
          />
        </View>
      </VariantSection>
    </View>
  );
}

/**
 * Série de exemplo no shape que a home do jogador consome
 * (`performance.byMonth`), pelo mesmo builder.
 */
const galleryResultsByMonth = [
  { losses: 1, month: "2026-04", wins: 2 },
  { losses: 2, month: "2026-05", wins: 1 },
  { losses: 0, month: "2026-06", wins: 3 },
  { losses: 1, month: "2026-07", wins: 2 },
  { losses: 2, month: "2026-08", wins: 3 },
  { losses: 1, month: "2026-09", wins: 4 },
];

const galleryMatchesByMonth = buildPlayerResultsChart(
  galleryResultsByMonth
).map((month) => ({
  label: month.label,
  value: month.wins + month.losses,
}));

function ChartCrosshairGallerySection() {
  return (
    <View className="gap-4">
      <Text color="muted" variant="description">
        Série de exemplo no mesmo shape da home do jogador (lá entra a série
        real de 6 meses). Toque e arraste no gráfico para ver o crosshair.
      </Text>
      <MonthlyChartCard
        data={galleryMatchesByMonth}
        description="Total de partidas por mês nos últimos 6 meses."
        title="Partidas por mês"
      />
    </View>
  );
}

function noop() {
  // sem ação por desenho: a galeria aprova, não executa.
}

function LabeledBlock(props: { children: ReactNode; label: string }) {
  return (
    <View className="gap-1">
      <Text color="muted" variant="description" weight="medium">
        {props.label}
      </Text>
      {props.children}
    </View>
  );
}

/**
 * Copy LITERAL do servidor (`convex/domains/payment/pendings-rules.ts`): o app
 * não monta mais essas descrições.
 */
const galleryPaymentDueDescription =
  "O pagamento da sua mensalidade venceu. Pague para não ser suspenso.";

const galleryPaymentSuspendedDescription =
  "Sua inscrição foi suspensa por falta de pagamento. Renove para voltar a jogar.";

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

/**
 * Descrição do servidor verbatim, em partes só para o prazo ficar em negrito;
 * a data usa o formato de `formatBrazilShortDate`.
 */
const galleryPaymentDueSoonParts: WidgetAlertDescriptionPart[] = [
  { text: "Renove até " },
  { isHighlighted: true, text: "12 de set. de 2026" },
  { text: " para continuar jogando sem interrupção." },
];

const galleryInactivityParts: WidgetAlertDescriptionPart[] = [
  { text: "Faltam " },
  { isHighlighted: true, text: "3 dias" },
  { text: " para você cair no ranking." },
];

/**
 * Cada tipo de pendência vira uma LINHA com o próprio número, com o destaque
 * na expressão número + objeto.
 */
const galleryPendingActionsLines: WidgetAlertDescriptionLine[] = [
  {
    parts: [
      { isHighlighted: true, text: "2 resultados" },
      { text: " para registrar" },
    ],
  },
  {
    parts: [
      { isHighlighted: true, text: "1 resultado" },
      { text: " para confirmar" },
    ],
  },
];

const galleryOrganizerValidationLines: WidgetAlertDescriptionLine[] = [
  {
    parts: [
      { isHighlighted: true, text: "2 resultados" },
      { text: " para validar" },
    ],
  },
  {
    parts: [
      { isHighlighted: true, text: "1 proposta" },
      { text: " para decidir" },
    ],
  },
];

const galleryOrganizerOverdueByLeagueParts: WidgetAlertDescriptionPart[] = [
  { isHighlighted: true, text: "2 cobranças" },
  { text: " vencidas na Liga do Parque." },
];

const galleryOrganizerOverdueByOrganizationParts: WidgetAlertDescriptionPart[] =
  [
    { isHighlighted: true, text: "3 cobranças" },
    { text: " vencidas nas suas ligas." },
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

/**
 * O mesmo aviso de push nos três moldes que o app desenha; o quarto
 * (`RNAlert.alert`) não dá para mostrar aqui.
 */
function NoticeMoldsVariants() {
  return (
    <VariantSection
      note="Os três fazem o mesmo trabalho no app. Os blocos a e b mostram o aviso com o CTA de uma palavra (Ajustes): o rótulo real de hoje é Abrir ajustes, com duas palavras, e fica apontado como divergência. A descrição dos dois é a copy real do aviso, mantida como estava — sem destaque: a frase não tem palavra-chave (apontado). Existe ainda um quarto molde fora da tela, o RNAlert.alert nativo com o mesmo aviso (settings/notifications.tsx:381-395), que não dá para mostrar aqui. O `WidgetAlert` ganhou nesta rodada o `isIndicatorHidden` (o cartão de notificação usa), sem mudança de desenho para os chamadores que não passam a prop."
      title="Estilos divergentes hoje: o mesmo aviso em três moldes"
    >
      <View className="gap-4">
        <LabeledBlock label="a) WidgetAlert, o alerta do app (ui/widget-alert.tsx)">
          <WidgetAlert
            action={{ label: "Ajustes", onPress: noop }}
            description="Habilite as notificações nos ajustes do app para receber push."
            status="warning"
            title="Notificações bloqueadas"
          />
        </LabeledBlock>

        <LabeledBlock label="b) Alert cru do HeroUI, como está hoje em Notificações">
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Notificações bloqueadas</Alert.Title>
              <Alert.Description>
                Habilite as notificações nos ajustes do app para receber push.
              </Alert.Description>
            </Alert.Content>
            <Button onPress={noop} size="sm" variant="primary">
              <Button.Label>Ajustes</Button.Label>
            </Button>
          </Alert>
        </LabeledBlock>

        <LabeledBlock label="c) Surface bg-warning-soft, como está hoje no diálogo Iniciar">
          <Surface className="bg-warning-soft px-4 py-2">
            <Text color="warning" variant="description">
              Há 1 convite de dupla sem resposta · essa inscrição ficará de fora
              da chave.
            </Text>
          </Surface>
        </LabeledBlock>
      </View>
    </VariantSection>
  );
}

/**
 * Anatomia provada na doc bundled do heroui-native: Alert + Alert.Indicator +
 * Alert.Content, SEM slot de ações (a ação é um `Button`) e status default/
 * accent/success/warning/danger — NÃO existe `info`.
 */
function AlertsVariantsSection() {
  return (
    <View className="gap-6">
      <VariantSection
        note="Título, descrição e severidade LITERAIS do servidor (convex/domains/payment/pendings-rules.ts:104, ramo payment_due de buildMembershipPaymentPending), a MESMA copy do alerta da casa da liga (pages/leagues/player-overview.tsx:56-60, agora pelo renderer único). Sem destaque: a frase não tem palavra-chave (o servidor não manda data nem valor neste estado), apontado. O CTA é a versão de uma palavra (Pagar): o rótulo real Pagar agora (lib/leagues/presentation.ts:211-213) tem duas palavras e não é mais renderizado como botão, fica apontado como divergência até o servidor mandar o texto."
        title="Alerta 1 · REAL · Home do jogador: mensalidade em atraso"
      >
        <WidgetAlert
          action={{ label: "Pagar", onPress: noop }}
          description={galleryPaymentDueDescription}
          status="warning"
          title="Pagamento atrasado"
        />
      </VariantSection>

      <VariantSection
        note="Título e descrição LITERAIS do servidor, ramo do membro ativo dentro da janela de lembrete de renovação (convex/domains/payment/pendings-rules.ts:157-171), com a data do exemplo (12 de set. de 2026, o mesmo formato de formatBrazilShortDate no servidor). A descrição é a copy do servidor, verbatim, em partes só para a data (a palavra-chave que decide a renovação) ficar em negrito. CTA Renovar (o rótulo real Renovar mensalidade, duas palavras, fica apontado). Caso extra ao conjunto pedido, apontado no report."
        title="Alerta 2 · REAL · Liga (jogador): mensalidade perto do vencimento"
      >
        <WidgetAlert
          action={{ label: "Renovar", onPress: noop }}
          description={[{ parts: galleryPaymentDueSoonParts }]}
          status="warning"
          title="Mensalidade vence em 2 dias"
        />
      </VariantSection>

      <VariantSection
        note="Título, ação e descrição LITERAIS do servidor (convex/domains/payment/pendings-rules.ts:118-140, ramo suspended de buildMembershipPaymentPending: actionLabel Renovar em :129, descrição em :131-133, action pay_league_membership do base em :90) e severidade danger real. Este ramo RENDERIZA desde a correção do BUG-0042: o status suspended cai no papel guest e o GuestOverview monta o alerta (pages/leagues/guest-overview.tsx:35-41). O botão daqui é superfície de APROVAÇÃO VISUAL (a galeria aprova, não executa), mas o rótulo Renovar é o do item REAL: desde o IBX-0084 o CTA do suspenso é o botão do próprio alerta e quem executa é o runner compartilhado (lib/pendings/use-pending-action-runner.ts:323-328, gerar o PIX da membership e abrir o checkout) — o rodapé de entrada NÃO monta para o suspenso (leagues/[leagueId]/index.tsx:545, buildLeagueDetailsShowJoinFooter em lib/leagues/league-details-derived.ts:194-204), então não há dois botões de pagamento da MESMA membership na mesma tela (BUG-0042). Sem destaque: a frase não tem palavra-chave (o servidor não manda o valor nem a data da pendência), apontado. O rótulo de duas palavras Renovar inscrição era o CTA do rodapé do suspenso e SAIU do código junto com ele (o ramo suspended de getMembershipActionLabel foi apagado no IBX-0084): o rótulo do estado é Renovar, do servidor. O botão segue o padrão da doc: alerta danger usa variant danger. As descrições dos cartões 1 a 3 são a copy do servidor, que aqui já devolve string nos atrasados; destacar trechos delas só quando o servidor mandar em partes."
        title="Alerta 3 · REAL · Liga (jogador suspenso): mensalidade suspensa (em tela desde o BUG-0042)"
      >
        <WidgetAlert
          action={{ label: "Renovar", onPress: noop }}
          description={galleryPaymentSuspendedDescription}
          status="danger"
          title="Inscrição suspensa"
        />
      </VariantSection>

      <VariantSection
        note="Título real da casa do torneio (pages/tournaments/player-overview.tsx:108-117, com o singular 1 inscrição aguardando pagamento na mesma linha). Hoje esse alerta só tem título: a descrição e o CTA são PROPOSTA, e o Pagar é o rótulo real do botão do card Suas inscrições (:213-222), já de uma palavra. Sem destaque: a frase não tem palavra-chave (o valor que decide a inscrição é dado que só o contrato manda) — apontado."
        title="Alerta 4 · REAL + descrição e ação propostas · Torneio (jogador): inscrição aguardando pagamento"
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
        title="Alerta 5 · REAL + descrição e ações propostas · Torneio (jogador): convite de dupla recebido"
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
        note="Copy nova (hoje o estado só existe como chip Aguardando parceiro, lib/tournaments/tournament-details-derived.ts:124). A descrição traz o nome de quem foi convidado, a categoria e a competição, com o NOME em negrito (mesma régua do cartão 5: um destaque por linha e o dado que decide é de quem se espera resposta; categoria e competição ficam sem destaque: apontado). info = accent: o vocabulário do alerta não tem info (alert.md da versão instalada e ui/widget-alert.tsx:33)."
        title="Alerta 6 · PROPOSTA · Torneio (jogador): convite de dupla enviado"
      >
        <WidgetAlert
          description={[{ parts: galleryInviteSentParts }]}
          status="accent"
          title="Convite de dupla enviado"
        />
      </VariantSection>

      <VariantSection
        note="Copy nova (hoje o estado só existe como chip Aguardando aprovação, lib/tournaments/tournament-details-derived.ts:123). Sem destaque: a frase não tem palavra-chave (nem nome, nem valor, nem prazo) — apontado. info = accent, mesmo motivo do cartão 6."
        title="Alerta 7 · PROPOSTA · Torneio (jogador): inscrição aguardando aprovação do organizador"
      >
        <WidgetAlert
          description="O organizador precisa liberar sua inscrição para você entrar na chave."
          status="accent"
          title="Inscrição aguardando aprovação"
        />
      </VariantSection>

      <VariantSection
        note="Título e status REAIS e a CONTAGEM real por tipo do item `player_league_challenges_pending_actions` do SERVIDOR (convex/domains/league/pendings-rules.ts:118-190, uma linha por tipo de pendência de resultado; desde o cutover da Etapa 2 do PLN-0008 o agregado do cliente `buildPlayerPendingActionsAlert` + o resumo com · foram extintos). Cada linha tem o destaque na EXPRESSÃO da pendência (2 resultados / 1 resultado, número + objeto, nunca o número solto). Ver é o rótulo real dos alertas do organizador (pages/tournaments/organizer-overview.tsx) e já tem uma palavra."
        title="Alerta 8 · REAL + ação proposta · Liga (jogador): pendências de desafio (agregado em linhas)"
      >
        <WidgetAlert
          action={{ label: "Ver", onPress: noop }}
          description={galleryPendingActionsLines}
          status="warning"
          title="3 desafios precisando de atenção"
        />
      </VariantSection>

      <VariantSection
        note="Copy real do item `player_league_inactivity_risk` do SERVIDOR (convex/domains/league/pendings-rules.ts:355-384, desde o cutover da Etapa 2 do PLN-0008 — o builder do cliente `buildPlayerInactiveAlertCard` foi extinto), sem CTA. O texto é o mesmo da tela, em partes só para o prazo que decide a queda (Faltam 3 dias) ficar em negrito. A variante do prazo vencido é status danger com Você está inativo e Já se passaram N dias desde sua última partida."
        title="Alerta 9 · REAL · Liga (jogador): risco de inatividade"
      >
        <WidgetAlert
          description={[{ parts: galleryInactivityParts }]}
          status="warning"
          title="Risco de queda por inatividade"
        />
      </VariantSection>

      <VariantSection
        note="Título REAL enxuto, aprovado pelo usuário (o real é Conta de pagamento não conectada: os jogadores não conseguirão pagar., settings/leagues/[mode]/settings.tsx:363-368) e o status REAL é warning (o pedido citava danger); hoje o alerta só tem título. Descrição PROPOSTA e CTA Conectar: o rótulo real Conectar conta (pages/organization/organization-form-fields.tsx:1088) tem duas palavras e fica apontado. Sem destaque: a frase não tem palavra-chave (o valor da mensalidade é dado que só o contrato manda) — apontado."
        title="Alerta 10 · REAL + descrição e ação propostas · Configurações da liga: conta de pagamento não conectada"
      >
        <WidgetAlert
          action={{ label: "Conectar", onPress: noop }}
          description="Conecte a conta para os jogadores conseguirem pagar a mensalidade."
          status="warning"
          title="Conta de pagamento não conectada"
        />
      </VariantSection>

      <VariantSection
        note="Título e CTA reais (pages/tournaments/organizer-overview.tsx:66-78), com o singular 1 inscrição aguardando aprovação na mesma linha e o Ver levando para Inscrições na aba Pendências. O status real é accent, o pedido citava warning. Descrição PROPOSTA: hoje este alerta só tem título. Sem destaque: a frase não tem palavra-chave (a lista de quem espera liberação é dado que só o contrato manda) — apontado."
        title="Alerta 11 · REAL + descrição proposta · Torneio (organizador): inscrições aguardando aprovação"
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
        title="Alerta 12 · REAL + descrição proposta · Torneio (organizador): inscrições aguardando pagamento"
      >
        <WidgetAlert
          action={{ label: "Ver", onPress: noop }}
          description="A vaga entra na chave depois do pagamento confirmado."
          status="warning"
          title="2 inscrições aguardando pagamento"
        />
      </VariantSection>

      <VariantSection
        note="Copy nova (hoje a pendência vive nos cards da aba Solicitações, com aprovar e recusar, leagues/[leagueId]/requests.tsx:178-229, e no badge da aba, lib/leagues/league-navigation-tabs.ts:38-50). Revisar é proposta e já tem uma palavra. Sem destaque: a frase não tem palavra-chave (a lista de quem está esperando é dado que só o contrato manda) — apontado."
        title="Alerta 13 · PROPOSTA · Liga (organizador): solicitações de entrada"
      >
        <WidgetAlert
          action={{ label: "Revisar", onPress: noop }}
          description="Jogadores esperando aprovação para entrar na liga."
          status="warning"
          title="4 solicitações de entrada"
        />
      </VariantSection>

      <VariantSection
        note="Copy nova (hoje o estado só aparece como chip: Validação do organizador e Validar resultado em accent e Decisão do organizador em warning, lib/leagues/challenge-formatters.ts:36-41, :66-71 e :78-83). A descrição agregava dois tipos na mesma frase (resultados e propostas) e virou uma LINHA por tipo, com o destaque na EXPRESSÃO da pendência (2 resultados / 1 proposta, número + objeto — nunca o número solto). Sem CTA: a decisão do organizador acontece na própria tela do desafio, que ainda não tem um destino único a partir daqui (apontado)."
        title="Alerta 14 · PROPOSTA · Liga (organizador): desafio esperando validação (agregado em linhas)"
      >
        <WidgetAlert
          description={galleryOrganizerValidationLines}
          status="warning"
          title="3 desafios esperando sua validação"
        />
      </VariantSection>

      <VariantSection
        note="Copy nova, com DOIS apontamentos: sem placar não existe como estado hoje (a partida é A definir, Agendada, Encerrada ou W.O., lib/tournaments/tournament-details-derived.ts:137-148) e o texto real mais próximo é o aviso do diálogo Iniciar torneio, A chave tem N vagas em aberto (A definir) · o início só é liberado com a chave completa. (lib/tournaments/tournament-details-derived.ts:435-441), hoje renderizado como Surface bg-warning-soft (tournaments/[tournamentId]/index.tsx:730-736). Qual confronto conta como pendência ainda não tem regra. Sem destaque: falta a palavra-chave (qual rodada ou quadra está em aberto) — apontado. Sem CTA."
        title="Alerta 15 · PROPOSTA · Torneio (organizador): confronto sem agendamento"
      >
        <WidgetAlert
          description="A chave fica pronta para começar quando todos os confrontos estiverem agendados."
          status="warning"
          title="4 confrontos sem agendamento"
        />
      </VariantSection>

      <VariantSection
        note="PROPOSTA (não aprovada). Origem do dado: as memberships com status payment_due ou suspended nas ligas PAGAS da organização, o MESMO dado do KPI Em atraso da home da organização (components/pages/home/organizer-dashboard.tsx:69-72, sobre payment.dashboard.getOverview: convex/functions/payment/dashboard.ts:96-116). O cartão mostra as DUAS agregações possíveis do MESMO dado. O contrato precisa mandar: kind novo organization_league_charges_overdue na opção 1, com source {type: league, id}, params {leagueId}, count e moneyCents da soma das cobranças da liga; kind novo organization_charges_overdue na opção 2, sem params; deadlineAt = vencimento mais antigo das cobranças agregadas; domain payment; severity warning; title e descrição como os das opções; actionLabel Ver. Destino do CTA Ver: sem destino hoje: o item nasceria sem CTA (como o Alerta 14) — não existe tela que liste cobranças ou membros em atraso do organizador (as abas da liga são Overview, Ranking, Desafios e Solicitações, lib/leagues/league-navigation-tabs.ts:15-19, e a aba Solicitações só lista pedidos de entrada, leagues/[leagueId]/requests.tsx:178-229). O CTA Ver fica no cartão como proposto."
        title="Alerta 16 · PROPOSTA · Organização: cobranças em atraso"
      >
        <View className="gap-4">
          <LabeledBlock label="Opção 1 · uma pendência por liga">
            <WidgetAlert
              action={{ label: "Ver", onPress: noop }}
              description={[{ parts: galleryOrganizerOverdueByLeagueParts }]}
              status="warning"
              title="Cobranças em atraso"
            />
          </LabeledBlock>

          <LabeledBlock label="Opção 2 · uma pendência pela organização">
            <WidgetAlert
              action={{ label: "Ver", onPress: noop }}
              description={[
                { parts: galleryOrganizerOverdueByOrganizationParts },
              ]}
              status="warning"
              title="Cobranças em atraso"
            />
          </LabeledBlock>
        </View>
      </VariantSection>

      <VariantSection
        note="PROPOSTA (não aprovada). Origem do dado: a membership em awaiting_payment e a cobrança do vínculo, PENDING no pendente e EXPIRED no vencido (payment.charge.getPendingCharge, o mesmo caminho do CTA Pagar da casa da liga, leagues/[leagueId]/index.tsx:227-238 e :286-304). O contrato precisa mandar: kind novo de escopo player (ex.: player_payment_charge_open no pendente e player_payment_charge_expired no vencido), source {type: payment_charge, id} (TIPO NOVO de fonte: PENDING_SOURCE_TYPE_OPTIONS hoje não tem payment_charge, convex/domains/pendings/contract.ts:73-79) + sourceId/sourceType da cobrança para o CTA Pagar reabrir o checkout (destino vivo: /checkout/[chargeId], settings/player/payments.tsx:152-155), deadlineAt = expiração do PIX, moneyCents = valor da cobrança, domain payment, actionLabel Pagar (Renovar quando a vaga foi liberada). REGRA de severidade: warning no PENDING e no EXPIRED com a vaga ainda reservada; danger quando o prazo terminou e a vaga foi liberada. BURACO na v1: o estado awaiting_payment não gera item nenhum hoje (evidência: membership de DEV n97ef6kqw5fsgvc9ng0hrddg7s8b3avs), então o jogador que gerou o PIX e não pagou não tem aviso centralizado."
        title="Alerta 17 · PROPOSTA · Jogador: PIX pendente ou vencido"
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

      <NoticeMoldsVariants />
    </View>
  );
}

/**
 * Itens tirados do MESMO derivado do cartão do feed
 * (`buildNotificationMenuItems`) e na mesma régua de cor do `tone`: o que se
 * aprova aqui é o que sai na tela.
 */
function NotificationMenuAnatomy(props: {
  notification: NotificationCardItem;
}) {
  const items = buildNotificationMenuItems(props.notification);

  return (
    <LabeledBlock label="menu ⋮ (itens reais, na ordem e nas cores em que saem no cartão)">
      <View className="gap-1.5 rounded-2xl bg-surface-secondary px-3 py-2.5">
        {items.map((item, index) => (
          <View
            className="flex-row items-center gap-2"
            key={`${index}-${item.label}`}
          >
            <Text
              color={item.tone === "danger" ? "danger" : "foreground"}
              variant="body"
              weight="medium"
            >
              {`${index + 1}. ${item.label}`}
            </Text>
            <Text color="muted" size="xs">
              {item.kind === "action"
                ? `tom ${item.tone} · ${item.resolution.kind}`
                : `tom ${item.tone} · remove o item da central`}
            </Text>
          </View>
        ))}
        <Text color="muted" size="xs">
          Mapa de cor: DANGER só no que é recusa ou destrutivo (Recusar, Remover
          notificação); todo o resto é o neutro do componente (Aceitar, Aprovar,
          Pagar, Renovar e a navegação). O Menu.Item só tem as variants default
          e danger.
        </Text>
      </View>
    </LabeledBlock>
  );
}

/** Estado do item usado no cartão de estados (informativo, sem ação). */
const galleryNotificationStateItem = buildGalleryNotificationItem(
  "tournament.entry.confirmed"
);

/**
 * Cartão REAL do feed (`components/notifications/notification-card.tsx`), com a
 * copy dos dois builders do servidor; o corte de 1/2 linhas é do FEED, por isso
 * aqui entra `isClamped={false}`.
 */
function NotificationVariantsSection() {
  return (
    <View className="gap-6">
      {NOTIFICATION_GALLERY_GROUPS.map((group) => (
        <View className="gap-6" key={group.title}>
          <Text color="muted" variant="description" weight="medium">
            {group.title}
          </Text>
          {group.eventTypes.map((eventType) => {
            const item = buildGalleryNotificationItem(eventType);
            const hasAction = buildNotificationMenuItems(item).some(
              (menuItem) => menuItem.kind === "action"
            );

            return (
              <VariantSection
                key={eventType}
                note={buildGalleryNotificationNote(eventType)}
                title={`Notificação ${
                  NOTIFICATION_GALLERY_EVENT_TYPES.indexOf(eventType) + 1
                } · ${group.title}: ${eventType}`}
              >
                <NotificationCard
                  isClamped={false}
                  notification={item}
                  onOpen={noop}
                  onRemove={noop}
                />
                {hasAction ? (
                  <View className="mt-3">
                    <NotificationMenuAnatomy notification={item} />
                  </View>
                ) : null}
                {eventType === "league.membership.renewal_reminder" ? (
                  <View className="mt-3 gap-4">
                    {RENEWAL_REMINDER_DAYS_LEFT_VARIANTS.map((variant) => (
                      <LabeledBlock key={variant.label} label={variant.label}>
                        <NotificationCard
                          isClamped={false}
                          notification={buildGalleryNotificationItem(
                            eventType,
                            {
                              metadata: { daysLeft: variant.daysLeft },
                            }
                          )}
                          onOpen={noop}
                          onRemove={noop}
                        />
                      </LabeledBlock>
                    ))}
                  </View>
                ) : null}
              </VariantSection>
            );
          })}
        </View>
      ))}

      <VariantSection
        note="Além do alerta, o item da central pode mostrar a HORA e a MARCA de não lida (o ponto, que hoje vem junto com o título em accent). O pedido literal do usuário é o bloco a; a marca de não lida importa porque o badge da home e de Configurações conta as não lidas (notification.settings.status). O desenho final é escolha dele: o feed entra hoje com os três blocos ligados (hora e ponto), sem tirar informação que a tela já mostrava. O CORTE de texto veio de antes e segue valendo NO FEED: lá o título sai em 1 linha e a descrição em 2 (era o `numberOfLines` do item antigo, mantido igual na extração). NESTA GALERIA os cartões entram SEM corte (prop `isClamped={false}`) para a copy do servidor aparecer INTEIRA na conferência: é por isso que o texto que ele lê aqui não 'muda' — é o mesmo texto, e no feed ele aparece com reticências. Se ele quiser o texto inteiro também no feed, é só riscar aqui. O item de ação não aparece no menu ⋮ deste cartão porque o evento é informativo: aqui o menu traz só o destrutivo (Remover notificação), como em qualquer cartão informativo."
        title="Estados do item: o que vai além do alerta"
      >
        <View className="gap-4">
          <LabeledBlock label="a) só título e descrição (o pedido literal)">
            <NotificationCard
              isClamped={false}
              notification={{ ...galleryNotificationStateItem, isRead: true }}
              onOpen={noop}
              onRemove={noop}
              showTimestamp={false}
              showUnreadMark={false}
            />
          </LabeledBlock>

          <LabeledBlock label="b) com a hora">
            <NotificationCard
              isClamped={false}
              notification={{ ...galleryNotificationStateItem, isRead: true }}
              onOpen={noop}
              onRemove={noop}
              showUnreadMark={false}
            />
          </LabeledBlock>

          <LabeledBlock label="c) com a marca de não lida (ponto + título em accent)">
            <NotificationCard
              isClamped={false}
              notification={galleryNotificationStateItem}
              onOpen={noop}
              onRemove={noop}
            />
          </LabeledBlock>
        </View>
      </VariantSection>

      <NoticeMoldsVariants />
    </View>
  );
}

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
  matchDate?: null | string;
  matchStatus?: null | string;
  menuActions?: boolean;
  /** Modalidade do caso, como a tela do chaveamento manda: a vaga em aberto não
   * tem parceiro para denunciar que a partida é de duplas. */
  modality?: "doubles" | "singles";
  /** Caso do NÓ: sai na largura da chave (320 pt, `CARD_WIDTH` do bracket). */
  nodeWidth?: boolean;
  note: string;
  scoreSets?: null | BracketScoreSet[];
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
    title: "Partida 1 · duplas · encerrado com resultado",
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
    title: "Partida 2 · duplas · agendado",
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
    title: "Partida 3 · duplas · W.O.",
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
    title: "Partida 3b · duplas · W.O. sem vencedor no wire",
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
    title: "Partida 4 · simples · encerrado com resultado",
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
    title: "Partida 5 · simples · agendado",
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
    title: "Partida 6 · duplas · a definir (sem chip de agendamento)",
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
    title: "Partida 7 · troca de oponente armada (chave)",
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
    note: "Menu do organizador no nó da chave, com os dois lados preenchidos: Agendar e Resultado. O menu é do CARD e só é desenhado onde há ação — nas agendas e no Próximo jogo nenhum card mostra menu.",
    stageLabel: "Quartas de final",
    startMinute: 840,
    title: "Partida 8 · chave · menu do organizador (Agendar + Resultado)",
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
    title: "Partida 9 · chave · menu do organizador (Editar resultado)",
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
      "Partida 10 · chave · duplas · adversário a definir (vaga vazia sem chip)",
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
    note: "Final decidida: o chip do topo vira Campeão, em accent. Quem sabe que é a final é a tela (o status do wire é 'finished', igual ao de qualquer partida encerrada).",
    stageLabel: "Final",
    startMinute: 1080,
    title: "Partida 11 · chave · final decidida com Campeão",
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
    title: "Partida 12 · simples · adversário a definir",
  },
];

function MatchCardVariantsSection() {
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
              matchDate={item.matchDate}
              matchStatus={item.matchStatus}
              modality={item.modality}
              onEditResultPress={item.menuActions ? noop : undefined}
              onResultPress={item.menuActions ? noop : undefined}
              onSchedulePress={item.menuActions ? noop : undefined}
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
    </View>
  );
}

/**
 * O card de inscrição reusa a base do card de partida: chips no topo (categoria
 * e status), a ponta com 1 ou 2 jogadores, as ações na ponta e o chip do pé
 * para a nota do estado. A galeria mostra os estados reais da inscrição.
 */
const galleryEntryCardCases: {
  actions?: ReactNode;
  categoryLabel: string;
  entryStatus: string;
  id: string;
  note: string;
  noteLabel?: null | string;
  partnerName?: null | string;
  playerName: string;
  title: string;
}[] = [
  {
    categoryLabel: "Duplas Mistas",
    entryStatus: "active",
    id: "confirmada",
    note: "Dupla confirmada: cada ponta é uma dupla, sem nota no pé e sem ação.",
    partnerName: "Rafael de Souza Lima",
    playerName: "Bruno William Garcia",
    title: "Inscrição 1 · dupla confirmada",
  },
  {
    actions: (
      <View className="flex-row gap-1">
        <Button isIconOnly size="sm" variant="outline">
          <HugeIcons icon={Cancel01Icon} />
        </Button>
        <Button isIconOnly size="sm">
          <HugeIcons className="text-accent-foreground" icon={Tick02Icon} />
        </Button>
      </View>
    ),
    categoryLabel: "Duplas Mistas",
    entryStatus: "pending_partner",
    id: "convite",
    note: "Convite de dupla recebido: a nota do pé diz quem convidou e a resposta vai na ponta.",
    noteLabel: "@marina.costa convidou você para esta dupla.",
    partnerName: "Rafael de Souza Lima",
    playerName: "Bruno William Garcia",
    title: "Inscrição 2 · convite de dupla recebido",
  },
  {
    actions: (
      <View className="flex-row gap-1">
        <Button isIconOnly size="sm" variant="outline">
          <HugeIcons icon={Cancel01Icon} />
        </Button>
        <Button isIconOnly size="sm">
          <HugeIcons className="text-accent-foreground" icon={Tick02Icon} />
        </Button>
      </View>
    ),
    categoryLabel: "Duplas Femininas",
    entryStatus: "pending_approval",
    id: "aprovacao",
    note: "Aprovação do organizador: o par recusar/aprovar fica na ponta e o status no topo.",
    partnerName: "Marina Costa",
    playerName: "Ana Beatriz Cardoso",
    title: "Inscrição 3 · aguardando aprovação",
  },
  {
    actions: (
      <Button size="sm">
        <Button.Label>Pagar</Button.Label>
      </Button>
    ),
    categoryLabel: "Simples Masculino",
    entryStatus: "awaiting_payment",
    id: "pagamento",
    note: "Inscrição do jogador aguardando pagamento: a ação fica na ponta.",
    playerName: "Tiago Moreira",
    title: "Inscrição 4 · aguardando pagamento",
  },
  {
    categoryLabel: "Simples Masculino",
    entryStatus: "active",
    id: "simples",
    note: "Simples: sem parceiro a ponta fica com UM avatar e UM nome.",
    playerName: "Tiago Moreira",
    title: "Inscrição 5 · simples confirmada",
  },
];

function EntryCardVariantsSection() {
  return (
    <View className="gap-6">
      {galleryEntryCardCases.map((item) => (
        <VariantSection key={item.id} note={item.note} title={item.title}>
          <EntryCard
            categoryLabel={item.categoryLabel}
            entryStatus={item.entryStatus}
            noteLabel={item.noteLabel}
            partnerName={item.partnerName}
            playerName={item.playerName}
          >
            {item.actions}
          </EntryCard>
        </VariantSection>
      ))}
    </View>
  );
}

/** DEV ONLY: mesmo gate `EXPO_PUBLIC_IS_DEV` da entrada e do checkout. */
export default function ComponentVariantsRoute() {
  const { component } = useLocalSearchParams<{ component: string }>();
  const entry = findComponentGalleryEntry(component);

  if (process.env.EXPO_PUBLIC_IS_DEV !== "true") {
    return null;
  }

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          {entry ? (
            <>
              <Page.Header.SubTitle>Componentes</Page.Header.SubTitle>
              <Page.Header.Title>{entry.title}</Page.Header.Title>
            </>
          ) : (
            <Page.Header.Title>Componentes</Page.Header.Title>
          )}
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-6 px-4 pb-safe-offset-4">
        {entry ? (
          entry.id === "kpi" ? (
            <KpiVariantsSection />
          ) : entry.id === "text" ? (
            <TextVariantsSection />
          ) : entry.id === "join-footer" ? (
            <JoinFooterVariantsSection />
          ) : entry.id === "chart-crosshair" ? (
            <ChartCrosshairGallerySection />
          ) : entry.id === "alerts" ? (
            <AlertsVariantsSection />
          ) : entry.id === "notifications" ? (
            <NotificationVariantsSection />
          ) : entry.id === "match-card" ? (
            <MatchCardVariantsSection />
          ) : entry.id === "entry-card" ? (
            <EntryCardVariantsSection />
          ) : null
        ) : (
          <EmptyState
            description="Escolha um componente na listagem de Componentes."
            title="Componente não encontrado"
          />
        )}
      </Page.ScrollView>
    </Page>
  );
}
