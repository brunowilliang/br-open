import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  BottomSheet,
  Button,
  Description,
  Input,
  Label,
  TextField,
  useToast,
  useBottomSheetAwareHandlers,
} from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Text } from "@/components/core/text";
import { HugeIcons } from "@/components/ui/huge-icons";
import { PressableFeedback } from "heroui-native";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "better-styled";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatEntryFeeLabel } from "@/lib/tournaments/tournament-details-derived";

const SOURCE_TYPE_TOURNAMENT_ENTRY = "tournament_entry";

export type JoinSheetCategory = {
  displayName: string;
  entryFeeCents: number;
  id: string;
  /** Categoria cheia: linha desabilitada no sheet. */
  isFull: boolean;
  modality: "doubles" | "singles";
  /** "{ativas}/{max} vagas" ou "Lotada"; null sem limite. */
  vacancyLabel: null | string;
};

type TournamentJoinSheetProps = {
  categories: JoinSheetCategory[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
};

/**
 * BottomSheet "Escolher categoria" (aberto pelo rodapé fixo de inscrição da
 * página do torneio): taxa por categoria, duplas convidam o parceiro por
 * username exato com checagem ao vivo (hint, nunca gate). Mutations:
 * create -> (awaiting_payment) createCharge -> checkout.
 */
export function TournamentJoinSheet(props: TournamentJoinSheetProps) {
  const { categories } = props;
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const router = useRouter();
  const { toast } = useToast();
  const [categoryId, setCategoryId] = useState<null | string>(null);
  const [partnerUsername, setPartnerUsername] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedUsername(partnerUsername.trim().toLowerCase()),
      500
    );

    return () => clearTimeout(timer);
  }, [partnerUsername]);

  const selectedCategory = categories.find((item) => item.id === categoryId);
  const isDoubles = selectedCategory?.modality === "doubles";
  const normalizedUsername = partnerUsername.trim().toLowerCase();
  const shouldCheckPartner =
    isDoubles &&
    debouncedUsername.length >= 3 &&
    debouncedUsername.length <= 30;

  // Live lookup of the typed partner username (exact match, same
  // normalization as the invite) — UX hint ONLY, never a submit gate: the
  // server validates the invite (same decision as the username precheck of
  // slice 1). Network failure stays neutral.
  const partnerQuery = useQuery({
    ...crpc.tournament.players.searchByUsername.staticQueryOptions({
      username: debouncedUsername,
    }),
    enabled: shouldCheckPartner && debouncedUsername.length > 0,
    staleTime: 15_000,
  });
  const partnerNotFound =
    shouldCheckPartner && partnerQuery.isSuccess && partnerQuery.data === null;

  const createCharge = useMutation({
    mutationFn: crpcClient.payment.charge.createCharge.mutate,
    mutationKey: crpc.payment.charge.createCharge.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível gerar o PIX. Tente novamente."
        ),
        id: "tournament-charge-error",
        label: "Falha ao gerar PIX",
        variant: "danger",
      });
    },
  });

  const createEntry = useMutation({
    mutationFn: crpcClient.tournament.entries.create.mutate,
    mutationKey: crpc.tournament.entries.create.mutationKey(),
    onError: (error) => {
      toast.show({
        description: getToastErrorMessage(
          error,
          "Não foi possível entrar no torneio. Tente novamente."
        ),
        id: "tournament-join-error",
        label: "Falha na inscrição",
        variant: "danger",
      });
    },
    onSuccess: async (entry) => {
      props.onOpenChange(false);

      if (entry.status === "awaiting_payment") {
        const charge = await createCharge.mutateAsync({
          sourceId: entry.id,
          sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
        });

        router.navigate({
          params: { chargeId: charge.chargeId },
          pathname: "/checkout/[chargeId]",
        });
        return;
      }

      toast.show({
        description:
          entry.status === "pending_partner"
            ? `Convite enviado para @${normalizedUsername}. Ele precisa aceitar para fechar a dupla.`
            : entry.status === "pending_approval"
              ? "Sua inscrição aguarda aprovação da organização."
              : "Você está inscrito no torneio!",
        id: "tournament-join-success",
        label: "Inscrição enviada",
        variant: "success",
      });
      setPartnerUsername("");
      setDebouncedUsername("");
      setCategoryId(null);
    },
  });

  function handleJoinPress() {
    if (!categoryId) {
      return;
    }

    createEntry.mutate({
      categoryId,
      ...(isDoubles && normalizedUsername
        ? { partnerUsername: normalizedUsername }
        : {}),
    });
  }

  return (
    <BottomSheet isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content enableOverDrag={false} keyboardBehavior="extend">
          <BottomSheet.Title>Escolher categoria</BottomSheet.Title>
          <BottomSheet.Description>
            {"Taxa por categoria. Duplas convidam o parceiro pelo username."}
          </BottomSheet.Description>

          <View className="mt-4 gap-2">
            {categories.map((category) => {
              const isSelected = category.id === categoryId;
              const descriptionParts = [
                category.entryFeeCents > 0
                  ? formatEntryFeeLabel(category.entryFeeCents)
                  : "Grátis",
                category.vacancyLabel,
              ].filter(Boolean);

              return (
                <PressableFeedback
                  className={cn(
                    "flex-row items-center justify-between rounded-xl px-4 py-3",
                    isSelected && "bg-surface-secondary",
                    category.isFull && "opacity-50"
                  )}
                  isDisabled={category.isFull}
                  key={category.id}
                  onPress={() => {
                    setCategoryId(category.id);
                  }}
                >
                  <View className="min-w-0 flex-1">
                    <Text
                      color={isSelected ? "accent" : "foreground"}
                      numberOfLines={1}
                      weight="medium"
                    >
                      {category.displayName}
                    </Text>
                    <Text color="muted" variant="description">
                      {descriptionParts.join(" · ")}
                    </Text>
                  </View>
                  {isSelected ? (
                    <HugeIcons className="text-accent" icon={Tick02Icon} />
                  ) : null}
                  <PressableFeedback.Highlight />
                </PressableFeedback>
              );
            })}
          </View>

          {isDoubles ? (
            <PartnerUsernameField
              hint={
                shouldCheckPartner
                  ? partnerQuery.isPending
                    ? "Buscando..."
                    : partnerQuery.isError
                      ? "Não foi possível verificar agora (a confirmação acontece ao enviar)."
                      : partnerNotFound
                        ? "Seu parceiro precisa de conta no app com username no perfil."
                        : `Encontrado: @${debouncedUsername}`
                  : "Dupla fixa: o parceiro precisa ter username definido."
              }
              isDisabled={createEntry.isPending}
              onChangeText={setPartnerUsername}
              value={partnerUsername}
            />
          ) : null}

          <View className="mt-5 flex-row gap-2 self-end">
            <Button
              onPress={() => {
                props.onOpenChange(false);
              }}
              size="sm"
              variant="secondary"
            >
              <Button.Label>Voltar</Button.Label>
            </Button>
            <Button
              isDisabled={
                createEntry.isPending ||
                !categoryId ||
                (isDoubles && normalizedUsername.length < 3)
              }
              onPress={handleJoinPress}
              size="sm"
            >
              <Button.Label>
                {createEntry.isPending
                  ? "Enviando..."
                  : selectedCategory && selectedCategory.entryFeeCents > 0
                    ? "Inscrever e pagar"
                    : "Confirmar inscrição"}
              </Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

type PartnerUsernameFieldProps = {
  hint: string;
  isDisabled: boolean;
  onChangeText: (text: string) => void;
  value: string;
};

/**
 * Campo do parceiro de dupla DENTRO do BottomSheet.Content (H1 da review da
 * composição): `useBottomSheetAwareHandlers` só funciona chamado de um
 * componente FILHO renderizado dentro do sheet (fora do provider os
 * handlers onFocus/onBlur são no-ops e o sheet perde o keyboard-avoidance)
 * — mesmo molde do `BottomSheetTextInput` da doc heroui-native
 * (bottom-sheet > With Keyboard-Aware Input), com `keyboardBehavior="extend"`
 * no Content.
 */
function PartnerUsernameField(props: PartnerUsernameFieldProps) {
  const { onBlur, onFocus } = useBottomSheetAwareHandlers();

  return (
    <TextField className="mt-4">
      <Label>Username do parceiro</Label>
      <Input
        autoCapitalize="none"
        autoCorrect={false}
        editable={!props.isDisabled}
        onBlur={onBlur}
        onChangeText={props.onChangeText}
        onFocus={onFocus}
        placeholder="@username do parceiro"
        value={props.value}
        variant="secondary"
      />
      <Description>{props.hint}</Description>
    </TextField>
  );
}
