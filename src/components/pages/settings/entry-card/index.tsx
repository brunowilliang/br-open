import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "heroui-native";
import type { ReactNode } from "react";
import { View } from "react-native";

import { VariantSection } from "@/components/pages/settings/shared";
import { EntryCard } from "@/components/ui/entry-card";
import { HugeIcons } from "@/components/ui/huge-icons";

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
    title: "Inscrição 1 | dupla confirmada",
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
    title: "Inscrição 2 | convite de dupla recebido",
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
    title: "Inscrição 3 | aguardando aprovação",
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
    title: "Inscrição 4 | aguardando pagamento",
  },
  {
    categoryLabel: "Simples Masculino",
    entryStatus: "active",
    id: "simples",
    note: "Simples: sem parceiro a ponta fica com UM avatar e UM nome.",
    playerName: "Tiago Moreira",
    title: "Inscrição 5 | simples confirmada",
  },
];

export function EntryCardVariantsSection() {
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
