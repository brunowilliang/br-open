import {
  AppleIcon,
  Cancel01Icon,
  Clock02Icon,
  DragDropVerticalIcon,
  GoogleIcon,
  Mail01Icon,
  ShieldUserIcon,
  Tick02Icon,
  UserCircleIcon,
  UserGroup02Icon,
} from "@hugeicons/core-free-icons";
import { useLocalSearchParams } from "expo-router";
import {
  Alert,
  Button,
  Chip,
  ListGroup,
  Separator,
  Surface,
  Tabs,
} from "heroui-native";
import { Fragment, type ComponentProps, type ReactNode, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { NotificationCard } from "@/components/notifications/notification-card";
import {
  LinkedAccountRow,
  LINKED_ACCOUNT_STATUS_CHIPS,
  type LinkedAccountStatus,
} from "@/components/pages/player/linked-account-row";
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
import { SortableCardList } from "@/components/ui/sortable-card-list";
import {
  StandingsCard,
  type StandingsCardItem,
  type StandingsFormSlot,
} from "@/components/ui/standings-card";
import {
  WidgetAlert,
  type WidgetAlertDescriptionPart,
} from "@/components/ui/widget-alert";
import { findComponentGalleryEntry } from "@/lib/dev/component-registry";
import {
  buildGalleryNotificationItem,
  buildGalleryNotificationNote,
  NOTIFICATION_GALLERY_EVENT_TYPES,
  NOTIFICATION_GALLERY_GROUPS,
} from "@/lib/dev/notification-gallery-fixtures";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildPlayerResultsChart } from "@/lib/home/player-dashboard-view";
import {
  buildNotificationMenuItems,
  type NotificationCardItem,
} from "@/lib/notifications/notification-view";
import type { ScoreSet } from "@/lib/matches/score-display";

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
            footerClassName="pb-safe-offset-3"
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
            footerClassName="pb-safe-offset-3"
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
            footerClassName="pb-safe-offset-3"
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
        note="PROPOSTA (não aprovada). Origem do dado: a inscrição de torneio com pagamento pendente e a cobrança da entry, PENDING no pendente e EXPIRED no vencido (payment.charge.getPendingCharge, o mesmo caminho do CTA Pagar da casa do torneio, tournaments/[tournamentId]/index.tsx:79-96). O contrato precisa mandar: kind novo de escopo player (ex.: player_payment_charge_open no pendente e player_payment_charge_expired no vencido), source {type: payment_charge, id} (TIPO NOVO de fonte: PENDING_SOURCE_TYPE_OPTIONS hoje não tem payment_charge, convex/domains/pendings/contract.ts:46-50) + sourceId/sourceType da cobrança para o CTA Pagar reabrir o checkout (destino vivo: /checkout/[chargeId], settings/player/payments.tsx:95-100), deadlineAt = expiração do PIX, moneyCents = valor da cobrança, domain payment, actionLabel Pagar (Renovar quando a vaga foi liberada). REGRA de severidade: warning no PENDING e no EXPIRED com a vaga ainda reservada; danger quando o prazo terminou e a vaga foi liberada. BURACO na v1: o estado awaiting_payment não gera item nenhum hoje (evidência: membership de DEV n97ef6kqw5fsgvc9ng0hrddg7s8b3avs), então o jogador que gerou o PIX e não pagou não tem aviso centralizado."
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

      <VariantSection
        note="O GESTO que só as duas homes ligam (opt-in `isSwipeEnabled` + `dismissSurface` na superfície `home`): arraste o cartão para a esquerda — ou toque nele — e a ação revelada Esconder aparece animando; tocar nela aqui não executa nada (a galeria aprova, não executa: o handler é o noop). O sangramento usa o MESMO par das homes (o `px-4` do container desta galeria é o `mx-4` da página delas): container `-mx-4`, childrenContainer `mx-4` e ação `pr-4 -ml-1`. A copy é a real do servidor para a inscrição aguardando pagamento — o que este cartão amostra é o gesto; o resto da seção segue estático de propósito."
        title="Alerta 18 · GESTO · o swipe com a ação revelada Esconder"
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
  scoreSets?: null | ScoreSet[];
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

/**
 * A mesma linha do `/settings/security`, com o chip binário em cima do título:
 * um caso por estado, mais os extremos (rótulo longo, provedor fora da lista).
 */
const galleryLinkedAccountCases: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  id: string;
  isActionDisabled?: boolean;
  isInformational?: boolean;
  note: string;
  pendingAction?: "link" | "unlink";
  providerLabel: string;
  status: LinkedAccountStatus;
  title: string;
}[] = [
  {
    icon: AppleIcon,
    id: "conectada",
    note: "Conta conectada: chip em cima do título e ação desconectar.",
    providerLabel: "Apple",
    status: "connected",
    title: "Linha 1 · conta conectada",
  },
  {
    icon: GoogleIcon,
    id: "nao-conectada",
    note: "Conta fora: chip apagado em cima do título e ação conectar.",
    providerLabel: "Google",
    status: "disconnected",
    title: "Linha 2 · conta não conectada",
  },
  {
    icon: GoogleIcon,
    id: "conectando",
    note: "Conectar em andamento: o chip segue binário (não conectado) e só o botão conta o progresso, travado.",
    pendingAction: "link",
    providerLabel: "Google",
    status: "disconnected",
    title: "Linha 3 · botão conectando",
  },
  {
    icon: AppleIcon,
    id: "desconectando",
    note: "Desconectar em andamento: o chip segue conectado e quem conta o progresso é o botão.",
    pendingAction: "unlink",
    providerLabel: "Apple",
    status: "connected",
    title: "Linha 4 · botão desconectando",
  },
  {
    icon: GoogleIcon,
    id: "acao-travada",
    isActionDisabled: true,
    note: "Enquanto UMA conta conecta, as outras linhas ficam com a ação travada (hoje é o pendingProvider da seção).",
    providerLabel: "Google",
    status: "connected",
    title: "Linha 5 · ação travada por outra linha",
  },
  {
    icon: Mail01Icon,
    id: "informativa-conectada",
    isInformational: true,
    note: "Linha informativa: chip de status e sem ação. Alterar a senha continua na Segurança.",
    providerLabel: "E-mail e senha",
    status: "connected",
    title: "Linha 6 · informativa conectada",
  },
  {
    icon: Mail01Icon,
    id: "informativa-nao-conectada",
    isInformational: true,
    note: "A mesma informativa quando a conta não tem senha: o chip fica Não conectado e a linha esmaece, como hoje.",
    providerLabel: "E-mail e senha",
    status: "disconnected",
    title: "Linha 7 · informativa não conectada",
  },
  {
    icon: ShieldUserIcon,
    id: "rotulo-longo",
    note: "Rótulo comprido: o chip fica em cima e o título quebra sem empurrar a ação.",
    providerLabel: "Conta corporativa da Federação Paulista de Tênis",
    status: "disconnected",
    title: "Linha 8 · rótulo longo",
  },
  {
    icon: UserCircleIcon,
    id: "provedor-desconhecido",
    note: "Provedor fora dos três do app: entra por ícone e título, sem caso especial no componente.",
    providerLabel: "Discord",
    status: "connected",
    title: "Linha 9 · provedor fora da lista",
  },
];

/** Lista na ordem real da seção, para aprovar os separadores junto. */
const galleryLinkedAccountList: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  isInformational?: boolean;
  providerLabel: string;
  status: LinkedAccountStatus;
}[] = [
  {
    icon: Mail01Icon,
    isInformational: true,
    providerLabel: "E-mail e senha",
    status: "connected",
  },
  { icon: AppleIcon, providerLabel: "Apple", status: "connected" },
  { icon: GoogleIcon, providerLabel: "Google", status: "disconnected" },
];

const galleryLinkedAccountStatuses: LinkedAccountStatus[] = [
  "connected",
  "disconnected",
];

const galleryLinkedAccountChipColors = [
  "default",
  "success",
  "accent",
  "warning",
  "danger",
] as const;

const galleryLinkedAccountChipSizes: ("lg" | "md" | "sm")[] = [
  "sm",
  "md",
  "lg",
];

function LinkedAccountRowVariantsSection() {
  return (
    <View className="gap-6">
      {galleryLinkedAccountCases.map((item) => (
        <VariantSection key={item.id} note={item.note} title={item.title}>
          <ListGroup>
            <LinkedAccountRow
              icon={item.icon}
              isActionDisabled={item.isActionDisabled}
              isInformational={item.isInformational}
              onActionPress={noop}
              status={item.status}
              title={item.providerLabel}
            />
          </ListGroup>
        </VariantSection>
      ))}

      <VariantSection
        note="Ordem e separadores como a seção monta hoje."
        title="Lista real · informativa, Apple e Google"
      >
        <ListGroup>
          {galleryLinkedAccountList.map((item, index) => (
            <Fragment key={item.providerLabel}>
              {index > 0 ? <Separator className="mx-4" /> : null}
              <LinkedAccountRow
                icon={item.icon}
                isInformational={item.isInformational}
                onActionPress={noop}
                status={item.status}
                title={item.providerLabel}
              />
            </Fragment>
          ))}
        </ListGroup>
      </VariantSection>

      <VariantSection
        note="Proposta: Conectado em success e Não conectado em default (muted), em soft. As outras cores ficam para riscar."
        title="Variantes do chip · cor"
      >
        <View className="gap-2">
          {galleryLinkedAccountStatuses.map((status) => {
            const chip = LINKED_ACCOUNT_STATUS_CHIPS[status];

            return (
              <View
                className="flex-row flex-wrap items-center gap-2"
                key={status}
              >
                {galleryLinkedAccountChipColors.map((color) => (
                  <Chip color={color} key={color} size="sm" variant="soft">
                    <Chip.Label
                      className={chip.isLabelMuted ? "text-muted" : undefined}
                    >
                      {chip.label}
                    </Chip.Label>
                  </Chip>
                ))}
              </View>
            );
          })}
        </View>
      </VariantSection>

      <VariantSection
        note="Proposta é o sm; md e lg ficam visíveis para comparar."
        title="Variantes do chip · tamanho"
      >
        <View className="flex-row flex-wrap items-center gap-2">
          {galleryLinkedAccountChipSizes.map((size) => (
            <Chip color="success" key={size} size={size} variant="soft">
              <Chip.Label>
                {LINKED_ACCOUNT_STATUS_CHIPS.connected.label}
              </Chip.Label>
            </Chip>
          ))}
        </View>
      </VariantSection>
    </View>
  );
}

/**
 * Uma das pontas é o jogador do viewer: o card sai em accent e é o único com a
 * fileira de forma preenchida — as outras ficam com as casas neutras do
 * fallback, que é o que a peça desenha sem dado de forma.
 */
const galleryStandingsViewerId = "diego-nakamura-alves";

/**
 * Mistura de exemplo da fileira: ganha, ganha, perdida, perdida, ganha. A
 * bolinha tem só as duas cores (verde ganha, vermelha perdida).
 */
const galleryStandingsForm: StandingsFormSlot[] = [
  { outcome: "win" },
  { outcome: "win" },
  { outcome: "loss" },
  { outcome: "loss" },
  { outcome: "win" },
];

const galleryStandingsItems: StandingsCardItem[] = [
  {
    avatarUrl: null,
    id: "marina-costa",
    name: "Marina Costa",
    nickname: "marina.costa",
    position: 1,
  },
  {
    avatarUrl: null,
    id: "diego-nakamura-alves",
    name: "Diego Nakamura Alves",
    nickname: "diego.nakamura",
    position: 2,
  },
  {
    avatarUrl: null,
    id: "rafael-de-souza-lima",
    name: "Rafael de Souza Lima",
    nickname: "rafael.lima",
    position: 3,
  },
  {
    avatarUrl: null,
    id: "bruno-william-garcia",
    name: "Bruno William Garcia",
    nickname: "bruno.garcia",
    position: 4,
  },
];

/**
 * O seletor manda: as duas variantes existem para quem está olhando, sem
 * depender de papel nenhum. Só o arrasto da primeira muda o estado local.
 */
function StandingsCardVariantsSection() {
  const [items, setItems] = useState(galleryStandingsItems);
  const [variant, setVariant] = useState("drag");

  function handleOrderChange(reorderedItems: StandingsCardItem[]) {
    setItems(
      reorderedItems.map((item, index) => ({
        ...item,
        position: index + 1,
      }))
    );
  }

  return (
    <Tabs onValueChange={setVariant} value={variant}>
      <Tabs.List className="w-full">
        <Tabs.ScrollView>
          <Tabs.Indicator />
          <Tabs.Trigger className="flex-1" value="drag">
            <Tabs.Label>Com drag</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger className="flex-1" value="static">
            <Tabs.Label>Sem drag</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.ScrollView>
      </Tabs.List>

      <Tabs.Content className="pt-4" value="drag">
        <VariantSection
          note="Segure a alça à esquerda do avatar e arraste: quem reordena é o estado local, sem servidor nem query. No item em accent (o jogador do viewer) a forma traz a mistura de exemplo (ganha, ganha, perdida, perdida, ganha); nas outras pontas saem as casas cinzas do fallback sem dado."
          title="Lista reordenável · com a alça"
        >
          <View className="h-96">
            <SortableCardList
              data={items}
              fillAvailableHeight
              itemGap={8}
              onOrderChange={handleOrderChange}
              renderItem={({ dragHandle, isActive, item }) => (
                <StandingsCard
                  dragHandle={dragHandle(
                    <Button
                      isDisabled={isActive}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                    >
                      <HugeIcons
                        className="text-muted"
                        icon={DragDropVerticalIcon}
                      />
                    </Button>
                  )}
                  form={
                    item.id === galleryStandingsViewerId
                      ? galleryStandingsForm
                      : undefined
                  }
                  isDragging={isActive}
                  isViewer={item.id === galleryStandingsViewerId}
                  item={item}
                />
              )}
            />
          </View>
        </VariantSection>
      </Tabs.Content>

      <Tabs.Content className="pt-4" value="static">
        <VariantSection
          note="A mesma lista sem a alça: posição, avatar, nome e nickname, só leitura. A mistura de exemplo da forma segue no item em accent."
          title="Lista estática · sem a alça"
        >
          <View className="gap-2">
            {items.map((item) => (
              <StandingsCard
                form={
                  item.id === galleryStandingsViewerId
                    ? galleryStandingsForm
                    : undefined
                }
                isViewer={item.id === galleryStandingsViewerId}
                item={item}
                key={item.id}
              />
            ))}
          </View>
        </VariantSection>
      </Tabs.Content>
    </Tabs>
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
          ) : entry.id === "linked-account" ? (
            <LinkedAccountRowVariantsSection />
          ) : entry.id === "standings-card" ? (
            <StandingsCardVariantsSection />
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
