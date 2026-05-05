import { Settings02Icon } from "@hugeicons/core-free-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Text } from "react-native";

import { Header } from "@/components/ui/header";
import { Page } from "@/components/ui/page";
import { useSignOutMutationOptions } from "@/lib/convex/auth-client";

export default function HomePrivate() {
  const router = useRouter();
  const signOut = useMutation(useSignOutMutationOptions());

  return (
    <Page>
      <Page.Header>
        <Page.Header.Left />
        <Page.Header.Center>
          <Page.Header.Title>Home Page</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right>
          <Header.Icon
            className="size-5.5 text-foreground"
            icon={Settings02Icon}
            onPress={() => router.push("/settings")}
          />
        </Page.Header.Right>
      </Page.Header>
      <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
        <Text>PRIVATE</Text>
        <Button onPress={() => signOut.mutate()}>
          {signOut.isPending ? "Signing out..." : "Sign out"}
        </Button>
      </Page.ScrollView>
    </Page>
  );
}
