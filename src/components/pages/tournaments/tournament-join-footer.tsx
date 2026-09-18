import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Select,
  TextField,
  useToast,
} from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Page } from "@/components/core/NewPage";
import { SelectOptionItem } from "@/components/ui/select-option-item";
import { SelectScrollContent } from "@/components/ui/select-scroll-content";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";

const SOURCE_TYPE_TOURNAMENT_ENTRY = "tournament_entry";

type JoinFooterCategory = {
  displayName: string;
  entryFeeCents: number;
  id: string;
  maxEntries: null | number;
  modality: "doubles" | "singles";
};

type TournamentJoinFooterProps = {
  categories: JoinFooterCategory[];
  tournamentId: string;
};

/**
 * Rodapé de inscrição do torneio (molde league-join-footer): escolhe a
 * categoria, confirma (simples) ou convida o parceiro por username exato
 * com checagem ao vivo (duplas); categoria paga vai direto pro checkout.
 */
export function TournamentJoinFooter(props: TournamentJoinFooterProps) {
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
    <Page.Footer className="px-4 pt-4 pb-safe-offset-4">
      <View className="gap-3">
        <TextField isRequired>
          <Label>Categoria</Label>
          <Select
            isDisabled={createEntry.isPending}
            onValueChange={(nextValue) => {
              if (nextValue && !Array.isArray(nextValue)) {
                setCategoryId(String(nextValue.value));
              }
            }}
            selectionMode="single"
            value={
              selectedCategory
                ? {
                    label: selectedCategory.displayName,
                    value: selectedCategory.id,
                  }
                : undefined
            }
          >
            <Select.Trigger className="bg-surface-secondary">
              <Select.Value
                className="font-normal"
                placeholder="Escolha a categoria"
              />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <SelectScrollContent label="Escolha a categoria" width="trigger">
                {categories.map((category) => (
                  <SelectOptionItem
                    key={category.id}
                    label={`${category.displayName} · ${
                      category.entryFeeCents > 0
                        ? `R$ ${(category.entryFeeCents / 100).toFixed(2)}`
                        : "Grátis"
                    }`}
                    value={category.id}
                  />
                ))}
              </SelectScrollContent>
            </Select.Portal>
          </Select>
        </TextField>

        {isDoubles ? (
          <TextField isInvalid={partnerNotFound} isRequired>
            <Label>Username do parceiro</Label>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              editable={!createEntry.isPending}
              onChangeText={setPartnerUsername}
              placeholder="@username do parceiro"
              value={partnerUsername}
              variant="secondary"
            />
            <Description>
              {shouldCheckPartner
                ? partnerQuery.isPending
                  ? "Buscando..."
                  : partnerQuery.isError
                    ? "Não foi possível verificar agora (a confirmação acontece ao enviar)."
                    : partnerNotFound
                      ? "Não encontramos esse username (a confirmação final acontece ao enviar)."
                      : `Encontrado: @${debouncedUsername}`
                : "Dupla fixa: o parceiro precisa ter username definido."}
            </Description>
            <FieldError>
              {partnerNotFound ? "Não encontramos esse username." : ""}
            </FieldError>
          </TextField>
        ) : null}

        <Button
          isDisabled={
            createEntry.isPending ||
            !categoryId ||
            (isDoubles && normalizedUsername.length < 3)
          }
          onPress={handleJoinPress}
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
    </Page.Footer>
  );
}
