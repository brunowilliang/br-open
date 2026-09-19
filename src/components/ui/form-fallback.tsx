import type { ReactNode } from "react";

import { Page } from "@/components/core/NewPage";

type FormFallbackProps = {
  children: ReactNode;
  /**
   * Flow description rendered above the title with the exact same styles as
   * the loaded form screens (Page.Header.SubTitle), so the header looks
   * identical while form data is loading.
   */
  description?: string;
  title: string;
};

export function FormFallback(props: FormFallbackProps) {
  return (
    <Page>
      <Page.Header>
        <Page.Header.Left>
          <Page.Header.BackButton />
        </Page.Header.Left>
        <Page.Header.Center>
          {props.description ? (
            <Page.Header.SubTitle>{props.description}</Page.Header.SubTitle>
          ) : null}
          <Page.Header.Title>{props.title}</Page.Header.Title>
        </Page.Header.Center>
        <Page.Header.Right />
      </Page.Header>

      <Page.ScrollView contentContainerClassName="grow px-4 pb-safe-offset-4">
        {props.children}
      </Page.ScrollView>
    </Page>
  );
}
