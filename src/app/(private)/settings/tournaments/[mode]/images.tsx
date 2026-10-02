import { PressableFeedback } from "heroui-native";
import { useState } from "react";

import { Image } from "@/components/core/image";
import { Page } from "@/components/core/page";
import { MediaConfirmDialog } from "@/components/ui/media-confirm-dialog";
import { useTournamentFormRoute } from "@/lib/tournaments/tournament-form-store";

export default function TournamentImagesRoute() {
  const { avatarUrl, coverUrl, isMediaBusy, isSubmitPending, onMediaPress } =
    useTournamentFormRoute();
  const isDisabled = isSubmitPending;
  const isMediaUploading = isMediaBusy;
  const [mediaTarget, setMediaTarget] = useState<null | "avatar" | "cover">(
    null
  );

  return (
    <Page.ScrollView contentContainerClassName="gap-4 px-4 pb-safe-offset-4">
      <PressableFeedback
        className="aspect-video w-full overflow-hidden rounded-3xl"
        isDisabled={isDisabled || isMediaUploading}
        onPress={() => setMediaTarget("cover")}
      >
        <Image
          className="size-full"
          contentFit="cover"
          fallback="blue"
          source={coverUrl ?? undefined}
        />
        <PressableFeedback.Highlight />
      </PressableFeedback>

      <PressableFeedback
        className="-mt-20 self-center rounded-full"
        isDisabled={isDisabled || isMediaUploading}
        onPress={() => setMediaTarget("avatar")}
      >
        <Image
          alt="Perfil"
          className="size-30 rounded-full"
          fallback="blue"
          source={avatarUrl ?? undefined}
        />
        <PressableFeedback.Highlight />
      </PressableFeedback>

      <MediaConfirmDialog
        isOpen={mediaTarget !== null}
        onConfirm={() => {
          if (mediaTarget) {
            onMediaPress?.(mediaTarget);
          }
        }}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setMediaTarget(null);
          }
        }}
        target={mediaTarget === "cover" ? "banner" : "avatar"}
      />
    </Page.ScrollView>
  );
}
