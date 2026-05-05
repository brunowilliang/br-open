import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { router } from "expo-router";

import { Header } from "@/components/ui/header";
import { Page } from "@/components/ui/page";

export default function Registrations() {
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Header.Icon
            className="size-5.5 text-foreground"
            icon={ArrowLeft01Icon}
            onPress={() => router.back()}
          />
        </Page.Header.Left>
        <Page.Header.Center>
          <Page.Header.Title>Minhas inscrições</Page.Header.Title>
          <Page.Header.SubTitle>
            Competições em que você participa
          </Page.Header.SubTitle>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4" />
    </Page>
  );
}
