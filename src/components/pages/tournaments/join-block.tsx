import { SOURCE_TYPE_TOURNAMENT_ENTRY } from "@convex/domains/payment/contract";
import type { TournamentPlayerCard } from "@convex/domains/tournament/contract";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useToast } from "heroui-native";
import { useEffect, useState } from "react";

import {
  JoinFooter,
  type JoinFooterCategory,
  type JoinFooterPartnerOption,
} from "@/components/ui/join-footer";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import { getToastErrorMessage } from "@/lib/errors/toast-message";
import { formatCurrencyCents } from "@/lib/format/currency";
import { buildNewChargeCheckoutHref } from "@/lib/payments/checkout-route";

type JoinBlockProps = {
  /** Categorias escolhíveis e com vaga, já derivadas pela página. */
  categories: JoinFooterCategory[];
  /** Rótulo do CTA pela regra de preço (a página decide). */
  confirmLabel: string;
  hasActiveEntry: boolean;
  /** Menor taxa entre as categorias abertas; 0 = todas grátis. */
  minFeeCents: number;
};

/** Bloco de inscrição (visitante/jogador): o rodapé fixo com o painel, a busca
 * de parceiro e o create com checkout — a rota só monta quando a janela abre. */
export function JoinBlock(props: JoinBlockProps) {
  const { categories, confirmLabel, hasActiveEntry, minFeeCents } = props;
  const router = useRouter();
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();

  // Inscrição pelo rodapé: create → (awaiting_payment) abre o checkout sem
  // cobrança, que cria/reusa a cobrança já na tela. O POST à Woovi não entra
  // no caminho do toque.
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
    onSuccess: (entry, variables) => {
      if (entry.status === "awaiting_payment") {
        router.navigate(
          buildNewChargeCheckoutHref({
            sourceId: entry.id,
            sourceType: SOURCE_TYPE_TOURNAMENT_ENTRY,
          })
        );
        return;
      }

      toast.show({
        description:
          entry.status === "pending_partner"
            ? variables.partnerUsername
              ? `Convite enviado para @${variables.partnerUsername}. Ele precisa aceitar para fechar a dupla.`
              : "Convite enviado. Ele precisa aceitar para fechar a dupla."
            : entry.status === "pending_approval"
              ? "Sua inscrição aguarda aprovação da organização."
              : "Você está inscrito no torneio!",
        id: "tournament-join-success",
        label: "Inscrição enviada",
        variant: "success",
      });
    },
  });

  // players.searchByUsername devolve LISTA alfabética (≤10, [] = ninguém) por
  // prefixo; o servidor resolve o gênero pela categoria, o cliente nunca
  // manda gender.
  const [partnerSearch, setPartnerSearch] = useState("");
  const [debouncedPartnerSearch, setDebouncedPartnerSearch] = useState("");
  // Categoria escolhida no painel do JoinFooter, em tempo real: alimenta a
  // busca de parceiro; o painel continua dono da seleção.
  const [selectedCategoryId, setSelectedCategoryId] = useState<null | string>(
    null
  );

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedPartnerSearch(partnerSearch.trim().toLowerCase()),
      500
    );

    return () => clearTimeout(timer);
  }, [partnerSearch]);

  // A busca de parceiro usa a categoria selecionada no painel; sem categoria
  // — ou numa singles — fica desabilitada. O servidor resolve o gênero pela
  // categoria; o cliente nunca manda gender.
  const selectedJoinCategory = categories.find(
    (category) => category.id === selectedCategoryId
  );

  const partnerQuery = useQuery({
    ...crpc.tournament.players.searchByUsername.staticQueryOptions({
      categoryId: selectedCategoryId ?? "",
      username: debouncedPartnerSearch,
    }),
    enabled:
      selectedJoinCategory?.modality === "doubles" &&
      debouncedPartnerSearch.length >= 3 &&
      debouncedPartnerSearch.length <= 30,
    staleTime: 15_000,
  });

  // Busca de parceiro EM ANDAMENTO: janela do debounce (o termo cru já mudou
  // e o debounced ainda não acompanhou) ou fetch da query em curso — o rodapé
  // troca o Empty pelo LoadingState nesse caso.
  const isPartnerSearchPending =
    partnerQuery.isFetching ||
    debouncedPartnerSearch !== partnerSearch.trim().toLowerCase();

  const partnerCards = (
    Array.isArray(partnerQuery.data) ? partnerQuery.data : []
  ) as TournamentPlayerCard[];
  const partnerOptions: JoinFooterPartnerOption[] = partnerCards.map(
    (card) => ({
      avatarUrl: card.avatarUrl,
      fullName: card.fullName ?? card.nickname ?? `@${card.username ?? ""}`,
      username: card.username ?? "",
    })
  );

  return (
    <JoinFooter
      actionLabel={hasActiveEntry ? "Nova inscrição" : "Inscrever-se"}
      categories={categories}
      confirmLabel={createEntry.isPending ? "Enviando..." : confirmLabel}
      description="Selecione a sua categoria"
      footerClassName="pb-safe-offset-4"
      isActionPending={createEntry.isPending}
      isPartnerSearchPending={isPartnerSearchPending}
      onAction={(selection) => {
        if (!selection.categoryId) {
          return;
        }
        createEntry.mutate({
          categoryId: selection.categoryId,
          ...(selection.partnerUsername
            ? { partnerUsername: selection.partnerUsername }
            : {}),
        });
      }}
      onCategoryChange={setSelectedCategoryId}
      onSearchPartner={setPartnerSearch}
      partnerOptions={partnerOptions}
      price={
        minFeeCents > 0
          ? {
              amount: formatCurrencyCents(minFeeCents),
              prefix: "a partir de",
              suffix: "/jogador",
            }
          : { amount: "Grátis" }
      }
      title="Inscreva-se"
    />
  );
}
