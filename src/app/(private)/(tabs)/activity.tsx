import { Page } from "@/components/core/NewPage";
import { Text } from "@/components/core/text";
import { View } from "react-native";

const READER_SECTIONS = [
  {
    id: "intro",
    title: "Primeiro bloco",
    body: "Esse é o começo do reader. A ideia aqui é ter conteúdo rolando por baixo do header para validar o desfoque progressivo sem mexer no Page antigo.",
  },
  {
    id: "motion",
    title: "Scroll animado",
    body: "Quando a tela sobe, o header ganha presença aos poucos. O blur fica mais evidente no topo e dissolve embaixo, criando o degradê que vamos reutilizar em outras telas.",
  },
  {
    id: "reuse",
    title: "Componente universal",
    body: "O componente novo vive em core/page.tsx e concentra o comportamento de header, scroll e safe area. Assim a gente testa aqui e depois aplica nas telas que fizerem sentido.",
  },
  {
    id: "next",
    title: "Próximo passo",
    body: "Depois da base visual ficar certa, dá para evoluir título grande, subtítulo compacto, ações no header e variações de intensidade por tela.",
  },
  {
    id: "next2",
    title: "Próximo passo",
    body: "Depois da base visual ficar certa, dá para evoluir título grande, subtítulo compacto, ações no header e variações de intensidade por tela.",
  },
  {
    id: "next3",
    title: "Próximo passo",
    body: "Depois da base visual ficar certa, dá para evoluir título grande, subtítulo compacto, ações no header e variações de intensidade por tela.",
  },
  {
    id: "next4",
    title: "Próximo passo",
    body: "Depois da base visual ficar certa, dá para evoluir título grande, subtítulo compacto, ações no header e variações de intensidade por tela.",
  },
] as const;

export default function Activity(): React.ReactElement {
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Minha página</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-floating-tab-bar-offset-4">
        {READER_SECTIONS.map((section) => (
          <View className="gap-3 rounded-2xl bg-surface p-4" key={section.id}>
            <Text variant="title">{section.title}</Text>
            <Text color="muted">{section.body}</Text>
          </View>
        ))}
      </Page.ScrollView>
      {/* <Page.Footer  /> */}
    </Page>
  );
}
