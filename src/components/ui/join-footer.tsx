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
  /** Linha muted acima do valor (ex. "a partir de"); sem ela = só o valor. */
  prefix?: null | string;
  suffix?: null | string;
};

export type JoinFooterCategory = {
  displayName: string;
  id: string;
  /** Motivo PRONTO do servidor pra categoria incompatível: o painel só exibe. */
  ineligibleReason?: null | string;
  /** Categoria cheia: chip "Lotada" + linha desabilitada no seletor. */
  isFull?: boolean;
  /** Incompatível com o ator: MESMA linha desabilitada do "Lotada". */
  isIneligible?: boolean;
  modality: "doubles" | "singles";
  /** Preço da categoria pronto pra exibição (a derivada fica na página). */
  priceLabel: string;
  vacancyLabel?: null | string;
};

export type JoinFooterPartnerOption = {
  avatarUrl?: null | string;
  fullName: string;
  username: string;
};

export type JoinFooterSelection = {
  categoryId: null | string;
  /** Username do parceiro (só quando a categoria é doubles). */
  partnerUsername: null | string;
};

type JoinFooterProps = {
  actionLabel: string;
  /** Ação extra ao lado do CTA (fora do `isActionDisabled` de propósito). */
  actionTrailing?: ReactNode;
  availabilityLabel?: null | string;
  categories?: JoinFooterCategory[];
  confirmLabel?: string;
  description?: string;
  /** Padding da base, decisão da TELA (default `pb-safe-offset-3`). */
  footerClassName?: string;
  isActionDisabled?: boolean;
  /** Ação em andamento: trava os CTAs (a página troca o rótulo por "Enviando..."). */
  isActionPending?: boolean;
  /** Busca de parceiro em voo (debounce OU fetch): o painel troca o Empty pelo
   * `LoadingState` — "Nenhum jogador encontrado." só na busca RESOLVIDA. */
  isPartnerSearchPending?: boolean;
  onAction?: (selection: JoinFooterSelection) => void;
  /** Categoria selecionada EM TEMPO REAL (escolha e reset). */
  onCategoryChange?: (categoryId: null | string) => void;
  /** Busca de parceiro externa (modo assíncrono da doc do Autocomplete): com
   * o callback o filtro client-side desliga (`filter={() => true}`). */
  onSearchPartner?: (query: string) => void;
  partnerOptions?: JoinFooterPartnerOption[];
  price: JoinFooterPrice;
  title: string;
};

/** Pílula `MorphButton` na base da tela que expande pra cima. LIGA (sem
 * `categories`) = CTA dispara `onAction` direto; TORNEIO = CTA expande o painel
 * com seletor e, em doubles, o Autocomplete de parceiro. A expansão é SOMENTE
 * pelo botão (modo controlado: toque fora não fecha). Categoria e parceiro são
 * estado LOCAL e sobem no `onAction` da confirmação. */
export function JoinFooter(props: JoinFooterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<null | string>(
    null
  );
  const [selectedPartner, setSelectedPartner] =
    useState<null | AutocompleteOption>(null);
  const [partnerSearchTerm, setPartnerSearchTerm] = useState("");

  const hasCategories = (props.categories?.length ?? 0) > 0;
  const selectedCategory = props.categories?.find(
    (category) => category.id === selectedCategoryId
  );
  const isDoubles = selectedCategory?.modality === "doubles";
  // Mesmo corte de 3 chars do gate da página.
  const hasSearchedPartnerTerm = partnerSearchTerm.trim().length >= 3;
  // O Empty do Autocomplete monta com ZERO itens registrados: no modo assíncrono
  // o filtro é sempre-true, então "0 itens" = nada voltou AINDA — sem esta flag
  // a janela de carga lê como "nenhum jogador".
  const isPartnerSearching =
    hasSearchedPartnerTerm && Boolean(props.isPartnerSearchPending);
  // `AutocompleteOption` carrega só value/label: o avatar volta pela opção.
  const selectedPartnerOption = (props.partnerOptions ?? []).find(
    (option) => option.username === selectedPartner?.value
  );
  // Abaixo da safe area pra o diálogo não ficar sob o teclado.
  const insets = useSafeAreaInsets();

  function confirmSelection() {
    setIsOpen(false);
    setSelectedCategoryId(null);
    props.onCategoryChange?.(null);
    setSelectedPartner(null);
    props.onAction?.({
      categoryId: selectedCategoryId,
      partnerUsername: selectedPartner?.value ?? null,
    });
  }

  // Default via ternário e não via `cn`: o `cn` do app NÃO resolve conflito de
  // classes, então um `pb-*` do chamador não venceria o default.
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

          <Button
            // O `isDisabled` da raiz do MorphButton não alcança este botão
            // (morph-button.js:146 trava só o press da raiz): o gate de lotada
            // vale AQUI.
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
                    // Cheia ou incompatível: mesmo estado desabilitado, muda
                    // só o motivo exibido no chip.
                    const isUnavailable =
                      category.isFull || category.isIneligible;
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
                              {/* Sem motivo (perfil legado SEM gênero) a linha fica
                                  SEM chip DE PROPÓSITO: vagas não explicam. */}
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
                // FadeIn explícito: o bloco MONTA TARDE (só em doubles) e a prop
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
                          {/* O X é o responder mais interno: o toque nele NÃO
                              abre o diálogo. */}
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
                        {/* ScrollShadow direto no ScrollView da lista: a trava de
                            altura é do próprio List (max-height 280px). */}
                        <ScrollShadow color="surface">
                          <Autocomplete.List>
                            {(props.partnerOptions ?? []).map((partner) => {
                              // Item asChild = children único (Slot): o
                              // isSelected vem do estado do painel.
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
                        {/* O Autocomplete NÃO tem slot de Loading: em voo o Empty
                            cede lugar ao `LoadingState`. */}
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
          {/* Em duplas o CTA exige parceiro escolhido; em voo trava pela página. */}
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
