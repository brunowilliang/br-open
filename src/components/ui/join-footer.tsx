import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import { Button, Card, Chip, PressableFeedback } from "heroui-native";
import {
  Autocomplete,
  type AutocompleteOption,
  MorphButton,
} from "heroui-native-pro";
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Page } from "@/components/core/page";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { LoadingState } from "@/components/ui/loading-state";
import { PersonCard } from "@/components/ui/person-card";
import { ScrollShadow } from "@/components/ui/scroll-shadow";

export type JoinFooterPrice = {
  amount: string;
  /** Linha muted acima do valor (ex.: "a partir de" na pílula paga; sem ela = só o valor, ex. "Grátis"). */
  prefix?: null | string;
  suffix?: null | string;
};

export type JoinFooterCategory = {
  displayName: string;
  id: string;
  /**
   * Motivo PRONTO do servidor pra categoria incompatível com o ator
   * (contrato de discovery r27: `viewerIneligibleReason`): o painel só
   * exibe, nunca escreve copy própria.
   */
  ineligibleReason?: null | string;
  /** Categoria cheia: chip "Lotada" + linha desabilitada no seletor. */
  isFull?: boolean;
  /**
   * Categoria incompatível com o ator (contrato de discovery r27:
   * `viewerEligible === false`): MESMA linha desabilitada do "Lotada", com
   * o motivo do servidor no lugar do status de lotação — nunca escondida.
   */
  isIneligible?: boolean;
  modality: "doubles" | "singles";
  /** Preço da categoria pronto pra exibição (derivada fica na página). */
  priceLabel: string;
  /** Vagas da categoria prontas pra exibição (derivada fica na página). */
  vacancyLabel?: null | string;
};

/** Opção do autocomplete de parceiro: estática na galeria, busca viva na página. */
export type JoinFooterPartnerOption = {
  avatarUrl?: null | string;
  fullName: string;
  username: string;
};

/** Seleção local do painel no momento da confirmação (o wiring é da página). */
export type JoinFooterSelection = {
  categoryId: null | string;
  /** Username normalizado do parceiro escolhido (só quando a categoria é doubles). */
  partnerUsername: null | string;
};

type JoinFooterProps = {
  actionLabel: string;
  /**
   * Ação extra ao lado do CTA na pílula (liga: X de cancelar solicitação).
   * Fora do isActionDisabled de propósito: precisa responder mesmo com o
   * CTA desabilitado (o isDisabled do MorphButton só trava o press da
   * raiz, morph-button.js:146 — filhos recebem toque normal).
   */
  actionTrailing?: ReactNode;
  /** Vagas em chip success acima da superfície (molde da liga, hoje em leagues/[leagueId]/index.tsx). */
  availabilityLabel?: null | string;
  /**
   * Categorias do torneio: com a prop, o CTA expande o painel com o SELETOR
   * e a seção de dupla quando a categoria escolhida é doubles. Sem a prop
   * (liga), o CTA dispara `onAction` direto e o painel nunca abre.
   */
  categories?: JoinFooterCategory[];
  /** Rótulo do CTA de confirmação do painel (default = `actionLabel`). */
  confirmLabel?: string;
  description?: string;
  /**
   * Padding da base do rodapé, decisão da TELA: default `pb-safe-offset-3`
   * (sem tab bar, ex. galeria); tela com floating tab bar passa
   * `pb-floating-tab-bar-4` e o rodapé senta acima da barra (IBX-0074 r16).
   */
  footerClassName?: string;
  /**
   * Estado fechado do molde liga (lotada): superfície desabilitada por
   * inteiro, CTA inalcançável (o antigo league-join-footer desabilitava o
   * botão).
   */
  isActionDisabled?: boolean;
  /** Ação em andamento na página: trava os CTAs (a página troca o rótulo por "Enviando..."). */
  isActionPending?: boolean;
  /**
   * Busca de parceiro EM ANDAMENTO (janela do debounce OU fetch da query,
   * r30 — wiring da página): com termo válido o painel troca o Empty pelo
   * `LoadingState`, então "Nenhum jogador encontrado." fica reservado pra
   * busca já RESOLVIDA com zero resultados.
   */
  isPartnerSearchPending?: boolean;
  /** Confirmação: sobe a seleção local do painel (categoria + parceiro) pra página. */
  onAction?: (selection: JoinFooterSelection) => void;
  /**
   * Categoria selecionada EM TEMPO REAL (r26): dispara a cada mudança do
   * painel (escolha e reset na confirmação). A página usa pra buscar o
   * parceiro pela categoria certa; o estado interno continua do painel.
   */
  onCategoryChange?: (categoryId: null | string) => void;
  /**
   * Busca de parceiro externa (modo assíncrono oficial da doc do
   * Autocomplete): a página recebe o texto, busca e devolve as opções em
   * `partnerOptions`; com o callback o filtro client-side desliga
   * (`filter={() => true}`).
   */
  onSearchPartner?: (query: string) => void;
  /** Opções do autocomplete de parceiro. */
  partnerOptions?: JoinFooterPartnerOption[];
  price: JoinFooterPrice;
  /** "Inscreva-se" (molde torneio) ou "Preço" (molde liga). */
  title: string;
};

/**
 * Rodapé flutuante padronizado de inscrição/entrada (IBX-0074; renomeado
 * RegistrationFooter → JoinFooter por decisão do usuário em 20-09, antes de
 * chegar às telas): pílula MorphButton (heroui-native-pro) na base da tela
 * que expande pra cima (`direction="top"`, `variant="secondary"`).
 *
 * MODOS (derivam de `categories`): LIGA (sem `categories`) = o CTA dispara
 * `onAction` direto e o painel nunca abre; TORNEIO (com `categories`) = o
 * CTA expande o painel com seletor de categoria e, na modalidade doubles,
 * o Autocomplete de parceiro (heroui-native-pro, `presentation="dialog"`).
 * DESABILITADA = `isActionDisabled` trava a pílula inteira (lotada).
 *
 * Expansão SOMENTE pelo botão da pílula (modo controlado; toque fora não
 * fecha) e VOLTAR encolhe de volta. Seleção de categoria e parceiro são
 * estado LOCAL do painel: o CTA do painel fecha, reseta e sobe TUDO via
 * `onAction` (selection: categoria + username do parceiro — o wiring é da
 * página); a categoria também é exposta EM TEMPO REAL via `onCategoryChange`
 * (r26, busca de parceiro da página). Parceiro: `onSearchPartner` externa
 * (filtro client-side desligado, opções vivas) ou `partnerOptions` estática
 * com o filtro contains padrão. Dados vêm das props: `price` (pílula,
 * `prefix` opcional), `availabilityLabel` (chip de vagas) e `categories` com
 * labels prontos pra exibição (`priceLabel`, `vacancyLabel` — as derivadas
 * ficam na página).
 */
export function JoinFooter(props: JoinFooterProps) {
  // Expansão SOMENTE pelo botão (modo controlado, sem onOpenChange na
  // superfície) e VOLTAR/fechar por código.
  const [isOpen, setIsOpen] = useState(false);
  // Seleção e parceiro são estado LOCAL do painel; a confirmação sobe os
  // dois pra página via onAction.
  const [selectedCategoryId, setSelectedCategoryId] = useState<null | string>(
    null
  );
  const [selectedPartner, setSelectedPartner] =
    useState<null | AutocompleteOption>(null);
  // Termo vivo do diálogo (r22): define se o Empty é "não achou" (termo
  // válido buscado) ou o estado neutro inicial.
  const [partnerSearchTerm, setPartnerSearchTerm] = useState("");

  const hasCategories = (props.categories?.length ?? 0) > 0;
  const selectedCategory = props.categories?.find(
    (category) => category.id === selectedCategoryId
  );
  const isDoubles = selectedCategory?.modality === "doubles";
  // "Nenhum jogador encontrado." só com termo válido buscado (mesmo corte
  // de 3 chars do gate da página); abertura com campo vazio = neutro.
  const hasSearchedPartnerTerm = partnerSearchTerm.trim().length >= 3;
  // Busca em voo (r30): termo válido + debounce/fetch pendentes na página.
  // O Empty do Autocomplete monta com ZERO itens registrados — sem isso ele
  // lê a janela de carregamento como "nenhum jogador" (o filtro do modo
  // assíncrono é sempre-true, então "0 itens" = nada voltou AINDA).
  const isPartnerSearching =
    hasSearchedPartnerTerm && Boolean(props.isPartnerSearchPending);
  // AutocompleteOption carrega só value/label: o avatar do card do trigger
  // volta pela opção completa correspondente.
  const selectedPartnerOption = (props.partnerOptions ?? []).find(
    (option) => option.username === selectedPartner?.value
  );
  // Conteúdo do diálogo abaixo da safe area pra não ficar sob o teclado
  // (doc native autocomplete > Dialog and Bottom Sheet Presentations).
  const insets = useSafeAreaInsets();

  function confirmSelection() {
    // Fecha e reseta (mesmo reset do sheet extinto no sucesso): a próxima
    // abertura começa do zero; o resultado (checkout/toast) é da página.
    setIsOpen(false);
    setSelectedCategoryId(null);
    props.onCategoryChange?.(null);
    setSelectedPartner(null);
    props.onAction?.({
      categoryId: selectedCategoryId,
      partnerUsername: selectedPartner?.value ?? null,
    });
  }

  // Padding do Page.Footer é da tela: default = safe area (ex. galeria);
  // tela com floating tab bar passa footerClassName="pb-floating-tab-bar-4"
  // (IBX-0074 r16) e o rodapé senta acima da barra. O cn do app NÃO
  // resolve conflito de classes, por isso default via ternário.
  return (
    <Page.Footer
      className={cn(
        "flex-col items-center px-8",
        props.footerClassName ?? "pb-safe-offset-3"
      )}
    >
      {props.availabilityLabel ? (
        <Chip className="self-center" color="success" size="md" variant="soft">
          {props.availabilityLabel}
        </Chip>
      ) : null}
      <MorphButton
        direction="top"
        isDisabled={props.isActionDisabled}
        isOpen={isOpen}
        variant="secondary"
      >
        <MorphButton.CollapsedContent className="m-0 gap-3 py-2 pr-2 pl-4">
          <View>
            {props.price.prefix ? (
              <Text
                color="muted"
                numberOfLines={1}
                // size="xs"
                variant="description"
              >
                {props.price.prefix}
              </Text>
            ) : null}
            <View className="flex-row items-baseline gap-0.5">
              <Text size="base" weight="semibold">
                {props.price.amount}
              </Text>
              {props.price.suffix ? (
                <Text
                  color="muted"
                  numberOfLines={1}
                  // size="xs"
                  variant="description"
                >
                  {props.price.suffix}
                </Text>
              ) : null}
            </View>
          </View>

          {/* LIGA (sem categories): ação direta da página. TORNEIO: expande
              o painel (modo controlado — o toque na superfície não abre). */}
          <Button
            // Modo liga: o isDisabled da raiz não alcança este botão
            // (morph-button.js:146 trava só o press da raiz), então o gate
            // de lotada/!canRequestJoin vale AQUI (fix H1 do r24).
            isDisabled={
              props.isActionPending ||
              (!hasCategories && props.isActionDisabled)
            }
            onPress={
              hasCategories
                ? () => {
                    setIsOpen(true);
                  }
                : () => {
                    props.onAction?.({
                      categoryId: null,
                      partnerUsername: null,
                    });
                  }
            }
            size="sm"
          >
            {props.actionLabel}
          </Button>
          {props.actionTrailing}
        </MorphButton.CollapsedContent>
        <MorphButton.ExpandedContent className="w-80 gap-2 p-2">
          <View className="rounded-2xl p-3">
            <View className="gap-3">
              <View>
                <Text weight="semibold">{props.title}</Text>
                {props.description ? (
                  <Text color="muted" variant="description">
                    {props.description}
                  </Text>
                ) : null}
              </View>
              {props.categories && props.categories.length > 0 ? (
                <View className="gap-1">
                  {props.categories.map((category) => {
                    const isSelected = category.id === selectedCategoryId;
                    // Linha indisponível = cheia (molde do "Lotada") ou
                    // incompatível com o ator (r27): mesmo estado
                    // desabilitado, muda só o motivo exibido no chip.
                    const isUnavailable =
                      category.isFull || category.isIneligible;
                    // Motivo pronto do servidor (r27) quando incompatível.
                    const ineligibleReason = category.isIneligible
                      ? category.ineligibleReason
                      : null;

                    return (
                      <PressableFeedback
                        isDisabled={isUnavailable}
                        key={category.id}
                        onPress={() => {
                          setSelectedCategoryId(category.id);
                          props.onCategoryChange?.(category.id);
                        }}
                      >
                        <Card
                          className={cn(
                            "flex-row items-center justify-between px-4 py-3",
                            isSelected && "bg-accent-soft",
                            isUnavailable && "opacity-disabled"
                          )}
                          variant="transparent"
                        >
                          <View className="gap-1">
                            <Text
                              color={isSelected ? "accent" : "foreground"}
                              numberOfLines={1}
                              weight={isSelected ? "semibold" : undefined}
                            >
                              {category.displayName}
                            </Text>
                            <View className="flex-row items-center gap-1">
                              {/* Incompatível com o ator (r27): mesmo chip
                                  muted do "Lotada", exibindo o motivo do
                                  servidor (copy nunca é do cliente). Sem
                                  motivo — perfil SEM gênero (legado), r30 —
                                  a linha fica SEM chip DE PROPÓSITO: não
                                  cai para lotada/vagas, que não explicam o
                                  bloqueio. */}
                              {category.isIneligible ? (
                                ineligibleReason ? (
                                  <Chip className="bg-muted/20" size="sm">
                                    <Chip.Label className="text-foreground/80">
                                      {ineligibleReason}
                                    </Chip.Label>
                                  </Chip>
                                ) : null
                              ) : category.isFull ? (
                                <Chip className="bg-muted/20" size="sm">
                                  <Chip.Label className="text-foreground/80">
                                    Lotada
                                  </Chip.Label>
                                </Chip>
                              ) : category.vacancyLabel ? (
                                <Chip
                                  className={cn(!isSelected && "bg-muted/20")}
                                  size="sm"
                                  variant="soft"
                                >
                                  <Chip.Label
                                    className={cn(
                                      !isSelected && "text-foreground/80"
                                    )}
                                  >
                                    {category.vacancyLabel}
                                  </Chip.Label>
                                </Chip>
                              ) : null}
                            </View>
                          </View>

                          {/* Chip "Lotada" = status do isFull (estilo do
                              usuário); com limite = label da derivada; sem
                              limite = sem chip. */}
                          <View>
                            <Text
                              color={isSelected ? "accent" : "foreground"}
                              weight={isSelected ? "semibold" : undefined}
                            >
                              {category.priceLabel}
                            </Text>
                          </View>
                          <PressableFeedback.Highlight />
                        </Card>
                      </PressableFeedback>
                    );
                  })}
                </View>
              ) : null}
              {isDoubles ? (
                // Autocomplete em diálogo (heroui-native-pro). O bloco entra
                // com FadeIn.duration(180) (padrão de conteúdo do app) porque
                // MONTA TARDE — só quando doubles é escolhido — e a prop
                // `animation` do ExpandedContent não cobre sub-árvore tardia.
                <Animated.View
                  className="gap-1"
                  entering={FadeIn.duration(180)}
                >
                  <Autocomplete
                    filter={props.onSearchPartner ? () => true : undefined}
                    onInputChange={(query) => {
                      setPartnerSearchTerm(query);
                      props.onSearchPartner?.(query);
                    }}
                    onValueChange={setSelectedPartner}
                    presentation="dialog"
                    value={selectedPartner ?? undefined}
                  >
                    <Autocomplete.Trigger
                      asChild
                      className={"bg-transparent p-0"}
                    >
                      {/* asChild: o Slot compõe o onPress de abrir o diálogo
                          com o pressed do PressableFeedback. */}
                      <PressableFeedback>
                        <PersonCard
                          avatarUrl={selectedPartnerOption?.avatarUrl}
                          fullName={selectedPartner?.label}
                          isSelected={Boolean(selectedPartner)}
                          username={selectedPartner?.value}
                        >
                          {/* Remover: o X é responder mais interno, então o
                              toque nele NÃO abre o diálogo. Molde do X:
                              dialog-close-button.tsx (Cancel01Icon). */}
                          <Button
                            className="size-8"
                            isIconOnly
                            onPress={() => {
                              setSelectedPartner(null);
                            }}
                            variant="tertiary"
                          >
                            <HugeIcons className="size-5" icon={Cancel01Icon} />
                          </Button>
                        </PersonCard>
                      </PressableFeedback>
                    </Autocomplete.Trigger>
                    <Autocomplete.Portal>
                      <Autocomplete.Overlay />
                      <Autocomplete.Content
                        classNames={{ wrapper: "justify-start" }}
                        presentation="dialog"
                        styles={{ wrapper: { paddingTop: insets.top + 12 } }}
                      >
                        <Autocomplete.SearchField placeholder="Buscar jogador..." />
                        {/* Micro-fix (pedido do usuário): ScrollShadow no
                            scroll da lista — molde select-scroll-content.tsx:36-38
                            (ScrollShadow color=surface direto no ScrollView da
                            lista); a doc bundled do autocomplete NÃO usa
                            ScrollShadow, e a trava de altura é do próprio List
                            (.autocomplete__list max-height 280px), então sem
                            maxHeight aqui. */}
                        <ScrollShadow color="surface">
                          <Autocomplete.List>
                            {(props.partnerOptions ?? []).map((partner) => {
                              // ROUND 10: com asChild o children do Item é
                              // elemento único (Slot), então o isSelected
                              // vem do estado do painel — mesma fonte do
                              // render fn do round 7.
                              const isSelected =
                                selectedPartner?.value === partner.username;

                              return (
                                <Autocomplete.Item
                                  asChild
                                  className="my-1 p-0"
                                  key={partner.username}
                                  label={partner.fullName}
                                  textValue={`${partner.fullName} @${partner.username}`}
                                  value={partner.username}
                                >
                                  {/* asChild no Item: o press de seleção
                                      atravessa pro PressableFeedback. */}
                                  <PressableFeedback>
                                    <PersonCard
                                      avatarUrl={partner.avatarUrl}
                                      fullName={partner.fullName}
                                      isSelected={isSelected}
                                      username={partner.username}
                                    >
                                      {isSelected ? (
                                        <HugeIcons
                                          className="text-accent"
                                          icon={Tick02Icon}
                                        />
                                      ) : null}
                                    </PersonCard>
                                  </PressableFeedback>
                                </Autocomplete.Item>
                              );
                            })}
                          </Autocomplete.List>
                        </ScrollShadow>
                        {/* r30: enquanto a busca está em voo o ponto do
                            Empty mostra o LoadingState do app (o
                            Autocomplete NÃO tem slot de Loading — anatomy
                            da doc bundled: Trigger/Portal/Content/
                            SearchField/List/Item/Empty); o Empty volta só
                            com a busca resolvida. */}
                        {isPartnerSearching ? (
                          <LoadingState />
                        ) : (
                          <Autocomplete.Empty>
                            {hasSearchedPartnerTerm
                              ? "Nenhum jogador encontrado."
                              : "Busque pelo nome ou @username."}
                          </Autocomplete.Empty>
                        )}
                      </Autocomplete.Content>
                    </Autocomplete.Portal>
                  </Autocomplete>
                </Animated.View>
              ) : null}
            </View>
          </View>
          {/* VOLTAR encolhe de volta pra pílula; o CTA confirma com uma
              categoria escolhida (mesmo gate do extinto sheet:252-256: em
              duplas exige parceiro; em voo trava pela página). */}
          <View className="flex-row gap-2 self-stretch">
            <Button
              className="w-1/3"
              onPress={() => {
                setIsOpen(false);
              }}
              size="sm"
              variant="secondary"
            >
              Voltar
            </Button>
            <Button
              className="flex-1"
              isDisabled={
                props.isActionPending ||
                !selectedCategoryId ||
                Boolean(selectedCategory?.isIneligible) ||
                (isDoubles && !selectedPartner)
              }
              onPress={confirmSelection}
              size="sm"
            >
              {props.confirmLabel ?? props.actionLabel}
            </Button>
          </View>
        </MorphButton.ExpandedContent>
      </MorphButton>
    </Page.Footer>
  );
}
