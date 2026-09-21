import { Clock02Icon, UserGroup02Icon } from "@hugeicons/core-free-icons";
import { useLocalSearchParams } from "expo-router";
import { Alert, Button, Surface } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { NotificationCard } from "@/components/notifications/notification-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  JoinFooter,
  type JoinFooterCategory,
  type JoinFooterPartnerOption,
} from "@/components/ui/join-footer";
import { KpiCard } from "@/components/ui/kpi-card";
import { MonthlyChartCard } from "@/components/ui/monthly-chart-card";
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

/**
 * Moldura de variante na galeria: título curto e estável (numeração pra
 * aprovação: "KPI 1 · normal") + conteúdo. Mesmo título de seção leve
 * dos textos do app (molde schedule.tsx:162-164). `note` é a linha de
 * procedência usada pelos cartões de alerta (IBX-0076).
 */
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

/**
 * Galeria de variantes do KPI (IBX-0072): SOMENTE variantes do `KpiCard`
 * (ui/kpi-card.tsx) com as props que ele já tem — as composições de texto
 * solto saíram da galeria por ordem do usuário (o molde texto-simples dos
 * dashboards já está aprovado e frozen). Zero estilo novo.
 */
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

/**
 * Galeria de papéis do texto (IBX-0073): cada papel do app com um exemplo
 * real de conteúdo, via props do componente (`core/text.tsx`) — ZERO estilo
 * na mão. `align` é a única dimensão nova (classes já existentes); a
 * migração dos usos de tela é decisão pendente do usuário.
 */
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
 * Galeria do rodapé flutuante de inscrição (IBX-0074). ROUND 5 (esclarecimento
 * do usuário): as variantes são MODOS DE USO, não estados de chip — liga =
 * clique direto na ação (o painel nem abre); torneio = clique EXPANDE o painel
 * pra selecionar categoria (com duplas pra exercitar o campo de parceiro);
 * lotada = desabilitada. O chip de vagas é detalhe da variante de liga. O
 * rodapé é absoluto (Page.Footer): cada caixa h-28 ancora a instância no
 * próprio pai (RUL-0008). O CTA não tem ação aqui: o wiring é da página.
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
 * Série de EXEMPLO do item Gráfico (IBX-0075 r3): o MESMO shape que a home do
 * jogador consome (`performance.byMonth` do `player.dashboard.getOverview`)
 * passado pelo MESMO builder (`buildPlayerResultsChart`). A galeria é dev-only
 * e não consulta o dashboard (o dado real depende do ator jogador), então o
 * que aparece aqui é exemplo declarado — na home entra a série real de 6 meses.
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

/**
 * Seção do item Gráfico (IBX-0075 r3b): UM chart só (o usuário reprovou as 3
 * variantes numeradas) — o bloco "Partidas por mês" como ele vai entrar na
 * home, com o dado de EXEMPLO declarado abaixo.
 */
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

/** A galeria é superfície de aprovação visual: os CTAs não têm wiring
 * (IBX-0076). O feedback de toque é do próprio Button. */
function noop() {
  // sem ação por desenho: aqui o alerta se aprova, não se executa.
}

/**
 * Bloco rotulado dentro de um cartão (IBX-0076): usado nos três moldes
 * divergentes e nos blocos numerados dos cartões propostos 16 e 17.
 */
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
 * Copy dos estados de pagamento da liga do item Alertas: LITERAL do servidor
 * (`convex/domains/payment/pendings-rules.ts`), que passou a ser o dono dela no
 * cutover (IBX-0076 / PLN-0008) — o builder de alerta de pagamento do app
 * morreu e cada cartão cita o file:line do servidor na nota. Dado de exemplo
 * declarado, no MESMO shape que o contrato carrega.
 */
const galleryPaymentDueDescription =
  "O pagamento da sua mensalidade venceu. Pague para não ser suspenso.";

const galleryPaymentSuspendedDescription =
  "Sua inscrição foi suspensa por falta de pagamento. Renove para voltar a jogar.";

/**
 * Descrições do item Alertas (IBX-0076 r6): o TEXTO é o do r4, aprovado pelo
 * usuário — o r5 encurtou descrições que ele NÃO pediu para encurtar e o
 * encurtamento foi desfeito. A única mudança desta rodada é o DESTAQUE: no
 * máximo UM por linha, sempre a palavra-chave que identifica a pendência (nome
 * de pessoa, categoria, competição, valor, prazo, ou a expressão número +
 * objeto) — nunca número solto nem palavra genérica. O destaque é `bold`,
 * escolha do usuário. Dado de exemplo declarado, no MESMO shape que o contrato
 * futuro precisa carregar.
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

/** A data do exemplo do cartão 2, LITERAL do servidor (o mesmo formato
 * `12 de set. de 2026` que `formatBrazilShortDate` produz em
 * `convex/domains/payment/pendings-rules.ts`), separada para virar o destaque:
 * o texto do cartão é a descrição do servidor
 * (`convex/domains/payment/pendings-rules.ts:157-171`), verbatim, em partes só
 * para o prazo que decide a renovação ficar em negrito. */
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
 * Alerta que AGREGA mais de um tipo de pendência (IBX-0076 r4): cada tipo vira
 * uma LINHA com o seu número, em vez de uma frase com separador no meio (era
 * "2 resultados para registrar · 1 resultado para confirmar"). O destaque de
 * cada linha vai na EXPRESSÃO da pendência (número + objeto), nunca no número
 * solto.
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

/**
 * PROPOSTA (IBX-0076, Alerta 16): as DUAS agregações possíveis da cobrança em
 * atraso da organização. O destaque vai na EXPRESSÃO número + objeto (2
 * cobranças / 3 cobranças), nunca no número solto.
 */
const galleryOrganizerOverdueByLeagueParts: WidgetAlertDescriptionPart[] = [
  { isHighlighted: true, text: "2 cobranças" },
  { text: " vencidas na Liga do Parque." },
];

const galleryOrganizerOverdueByOrganizationParts: WidgetAlertDescriptionPart[] =
  [
    { isHighlighted: true, text: "3 cobranças" },
    { text: " vencidas nas suas ligas." },
  ];

/**
 * PROPOSTA (IBX-0076, Alerta 17): o PIX do jogador. O destaque é o dado que
 * decide a ação: o PRAZO no pendente e o VALOR no vencido.
 */
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
 * O aviso de push bloqueado nos TRÊS moldes que o app desenha hoje (o quarto
 * molde, o `RNAlert.alert` nativo, não dá para mostrar aqui). Compartilhado
 * pelos itens Alertas (IBX-0076) e Notificações (IBX-0077): é o MESMO aviso do
 * app, então a comparação serve aos dois e vive num lugar só (RUL-0005).
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
 * Galeria de alertas e pendências (IBX-0076): UM CARTÃO POR CASO, numerado,
 * com o contexto no título e o marcador REAL (a copy existe no app hoje) ou
 * PROPOSTA (copy nova). Padrão do HeroUI Native provado na doc bundled
 * (`node_modules/heroui-native/lib/module/components/alert/alert.md`): anatomia
 * Alert + Alert.Indicator + Alert.Content(Title, Description) SEM slot de
 * ações, a ação é um `Button` (`size="sm"`, `variant="primary"`, e
 * `variant="danger"` quando o status do alerta é danger), e os status são
 * default/accent/success/warning/danger (NÃO existe `info`). Ordem do usuário:
 * todo cartão com título E descrição, CTA de UMA palavra e ações DENTRO da
 * superfície do alerta (com duas ações, no rodapé). Nada aqui está wire em tela.
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
        note="Título e descrição LITERAIS do servidor (convex/domains/payment/pendings-rules.ts:121, ramo suspended de buildMembershipPaymentPending) e severidade danger real. Este ramo RENDERIZA desde a correção do BUG-0042: o status suspended cai no papel guest e o GuestOverview monta o alerta (pages/leagues/guest-overview.tsx:20-35). O botão daqui é superfície de APROVAÇÃO VISUAL (a galeria aprova, não executa): no servidor o item do suspenso nasce com actionLabel Renovar (pendings-rules.ts:120) e no app o caminho de pagamento é o CTA Renovar inscrição do RODAPÉ de entrada (leagues/[leagueId]/index.tsx:417 e :558). Sem destaque: a frase não tem palavra-chave (o servidor não manda o valor nem a data da pendência), apontado. CTA Renovar (o rótulo real Renovar inscrição, duas palavras, fica apontado) e o botão segue o padrão da doc: alerta danger usa variant danger. As descrições dos cartões 1 a 3 são a copy do servidor, que aqui já devolve string nos atrasados; destacar trechos delas só quando o servidor mandar em partes."
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
 * ANATOMIA do menu ⋮ em texto, para aprovação estática (rodada 3 do IBX-0077):
 * os itens na ORDEM real e NA COR real, tirados do MESMO derivado que o cartão
 * usa (`buildNotificationMenuItems`) — nenhum rótulo digitado aqui — com a
 * resolução de cada item ao lado (prova de que cada um leva a ação certa).
 *
 * A cor aqui é a MESMA régua semântica do `tone` do item (o perigo é
 * `text-danger` e todo o resto é o `foreground` do título do item do menu), então
 * o que o usuário aprova no olho é o que sai no cartão. O verde do sucesso saiu
 * na rodada 4 (ver `docs/spec/dashboard.md`).
 *
 * Só os cartões ACIONÁVEIS ganham o bloco: no informativo o menu tem um item só
 * (o destrutivo), que é o mesmo em todos os cartões.
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
 * Galeria do item da CENTRAL DE NOTIFICAÇÕES (IBX-0077 / PLN-0009): o cartão
 * REAL do feed (`components/notifications/notification-card.tsx`), com a copy
 * dos DOIS builders do servidor — `buildNotificationContent` (título/corpo) e
 * `buildNotificationPresentation` (ação, rótulos e destaques) — um cartão por
 * tipo do catálogo (44), nos 8 grupos aprovados, na ORDEM APROVADA deles (que
 * não é a do catálogo: o grupo 1 abre em `league.membership.approved`).
 *
 * O corpo do cartão é só título + descrição; as ações do servidor saem no menu
 * ⋮ (rodada 2, pedido do usuário) e o cartão acionável mostra ao lado o bloco
 * com os itens REAIS do menu, na ordem real e nas cores reais (rodada 3). Os
 * cartões da galeria entram SEM corte de texto (`isClamped={false}`): a copy do
 * servidor aparece inteira para o usuário conferir — o corte de 1/2 linhas é do
 * FEED e continua valendo lá. CTA nenhum executa: o `onAction` não é passado,
 * como o `noop` do IBX-0076 — a galeria aprova, não age. O wiring real (runner
 * compartilhado, `lib/pendings/use-pending-action-runner.ts`) está no feed.
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
 * Tela de variantes de um componente da galeria (rota dinâmica no padrão
 * settings/leagues/[mode]). DEV ONLY: mesmo gate `EXPO_PUBLIC_IS_DEV` da
 * entrada e do checkout — usuário final não chega aqui nem por deep link.
 */
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
