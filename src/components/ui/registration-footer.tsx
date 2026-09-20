import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import { Button, Card, Chip, PressableFeedback } from "heroui-native";
import {
  Autocomplete,
  type AutocompleteOption,
  MorphButton,
} from "heroui-native-pro";
import { useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { PersonCard } from "@/components/ui/person-card";
import { ScrollShadow } from "@/components/ui/scroll-shadow";

type RegistrationFooterPrice = {
  amount: string;
  suffix?: null | string;
};

export type RegistrationFooterCategory = {
  displayName: string;
  id: string;
  /** Categoria cheia: chip "Lotada" + linha desabilitada no seletor. */
  isFull?: boolean;
  modality: "doubles" | "singles";
  /** Preço da categoria pronto pra exibição (derivada fica na página). */
  priceLabel: string;
  /** Vagas da categoria prontas pra exibição (derivada fica na página). */
  vacancyLabel?: null | string;
};

type RegistrationFooterProps = {
  /**
   * Papel do CTA nos moldes: o torneio abre o BottomSheet de inscrição
   * (tournaments/[tournamentId]/index.tsx:488) e a liga dispara a mutação
   * de entrada (league-join-footer.tsx:345). O wiring é da página.
   */
  actionLabel: string;
  /** Vagas em chip success acima da superfície (molde league-join-footer.tsx:304). */
  availabilityLabel?: null | string;
  /**
   * Categorias do torneio: com a prop, o painel ganha o SELETOR (molde
   * TournamentJoinSheet:178-219) e a seção de dupla quando a categoria
   * escolhida é doubles. Sem a prop (liga), painel direto ao valor.
   */
  categories?: RegistrationFooterCategory[];
  description?: string;
  /**
   * Estado fechado do molde liga (lotada): superfície desabilitada por
   * inteiro, CTA inalcançável (league-join-footer.tsx:348 desabilitava o botão).
   */
  isActionDisabled?: boolean;
  onAction?: () => void;
  price: RegistrationFooterPrice;
  /** "Inscreva-se" (molde torneio, index.tsx:474) ou "Preço" (molde liga, :313). */
  title: string;
};

type PartnerOption = {
  fullName: string;
  username: string;
};

// Opções de exemplo (IBX-0074 round 6, sem wiring): a busca de verdade
// alimenta estas opções na página.
const PARTNER_OPTIONS: PartnerOption[] = [
  { fullName: "Gustavo Lima", username: "gustavo.lima" },
  { fullName: "Marina Costa", username: "marina.costa" },
  { fullName: "Pedro Almeida", username: "pedro.almeida" },
  { fullName: "Rafael Souza", username: "rafa.souza" },
  { fullName: "Camila Ferraz", username: "camila.ferraz" },
];

// Rótulo do chip de modalidade por categoria ("Single" = escolha do
// usuário no design final; "Duplas" segue o vocabulário do app).
const MODALITY_LABEL: Record<RegistrationFooterCategory["modality"], string> = {
  doubles: "Duplas",
  singles: "Single",
};

/**
 * Rodapé flutuante padronizado de inscrição (IBX-0074, estado FINAL):
 * pílula MorphButton (heroui-native-pro) na base da tela que expande pra
 * cima (`direction="top"`, `variant="secondary"`).
 *
 * MODOS (derivam de `categories`): LIGA (sem `categories`) = o CTA dispara
 * `onAction` direto e o painel nunca abre; TORNEIO (com `categories`) = o
 * CTA expande o painel com seletor de categoria e, na modalidade doubles,
 * o Autocomplete de parceiro (heroui-native-pro, `presentation="dialog"`).
 * DESABILITADA = `isActionDisabled` trava a pílula inteira (lotada).
 *
 * Expansão SOMENTE pelo botão da pílula (modo controlado; toque fora não
 * fecha — o MorphButton não tem outside-press); VOLTAR encolhe de volta.
 * Seleção de categoria e parceiro são estado LOCAL do painel: a página
 * confirma via `onAction` (o wiring é dela). Dados vêm das props: `price`
 * (pílula), `availabilityLabel` (chip de vagas acima da pílula) e
 * `categories` com labels prontos pra exibição (`priceLabel`,
 * `vacancyLabel` — as derivadas ficam na página).
 */
export function RegistrationFooter(props: RegistrationFooterProps) {
  // Expansão SOMENTE pelo botão (modo controlado, sem onOpenChange na
  // superfície) e VOLTAR/fechar por código.
  const [isOpen, setIsOpen] = useState(false);
  // Seleção e parceiro são estado LOCAL do painel (estrutura sem wiring;
  // a página confirma via onAction).
  const [selectedCategoryId, setSelectedCategoryId] = useState<null | string>(
    null
  );
  const [selectedPartner, setSelectedPartner] =
    useState<null | AutocompleteOption>(null);

  const hasCategories = (props.categories?.length ?? 0) > 0;
  const selectedCategory = props.categories?.find(
    (category) => category.id === selectedCategoryId
  );
  const isDoubles = selectedCategory?.modality === "doubles";
  // Conteúdo do diálogo abaixo da safe area pra não ficar sob o teclado
  // (doc native autocomplete > Dialog and Bottom Sheet Presentations).
  const insets = useSafeAreaInsets();

  return (
    <Page.Footer className="flex-col items-center px-8 pb-safe-offset-3">
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
            <Text
              color="muted"
              numberOfLines={1}
              size="xs"
              variant="description"
            >
              a partir de
            </Text>
            <View className="flex-row items-baseline gap-0.5">
              <Text size="base" weight="bold">
                {props.price.amount}
              </Text>
              {props.price.suffix ? (
                <Text
                  color="muted"
                  numberOfLines={1}
                  size="xs"
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
            onPress={
              hasCategories
                ? () => {
                    setIsOpen(true);
                  }
                : props.onAction
            }
            size="sm"
          >
            {props.actionLabel}
          </Button>
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

                    return (
                      <PressableFeedback
                        isDisabled={category.isFull}
                        key={category.id}
                        onPress={() => {
                          setSelectedCategoryId(category.id);
                        }}
                      >
                        <Card
                          className={cn(
                            "flex-row items-center justify-between",
                            isSelected && "bg-accent-soft",
                            category.isFull && "opacity-disabled"
                          )}
                          variant="transparent"
                        >
                          <View className="gap-1">
                            <Text
                              color={isSelected ? "accent" : "foreground"}
                              numberOfLines={1}
                              weight={isSelected ? "bold" : undefined}
                            >
                              {category.displayName}
                            </Text>
                            <View className="flex-row items-center gap-1">
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
                                  {MODALITY_LABEL[category.modality]}
                                </Chip.Label>
                              </Chip>

                              {category.isFull ? (
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
                              weight={isSelected ? "bold" : undefined}
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
                // Sem wiring: opções de exemplo no próprio componente.
                <Animated.View
                  className="gap-1"
                  entering={FadeIn.duration(180)}
                >
                  <Autocomplete
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
                        <Autocomplete.SearchField placeholder="Buscar parceiro..." />
                        {/* Micro-fix (pedido do usuário): ScrollShadow no
                            scroll da lista — molde select-scroll-content.tsx:36-38
                            (ScrollShadow color=surface direto no ScrollView da
                            lista); a doc bundled do autocomplete NÃO usa
                            ScrollShadow, e a trava de altura é do próprio List
                            (.autocomplete__list max-height 280px), então sem
                            maxHeight aqui. */}
                        <ScrollShadow color="surface">
                          <Autocomplete.List>
                            {PARTNER_OPTIONS.map((partner) => {
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
                        <Autocomplete.Empty>
                          Nenhum jogador encontrado.
                        </Autocomplete.Empty>
                      </Autocomplete.Content>
                    </Autocomplete.Portal>
                  </Autocomplete>
                </Animated.View>
              ) : null}
            </View>
          </View>
          {/* VOLTAR encolhe de volta pra pílula; Inscrever confirma com uma
              categoria escolhida (mesmo gate do sheet:258). */}
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
              // Mesmo gate do sheet (sheet:258): com categorias, confirma
              // só com uma escolhida.
              isDisabled={hasCategories && !selectedCategoryId}
              onPress={props.onAction}
              size="sm"
            >
              {props.actionLabel}
            </Button>
          </View>
        </MorphButton.ExpandedContent>
      </MorphButton>
    </Page.Footer>
  );
}
