import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import type { FieldErrors, Resolver } from "react-hook-form";

import {
  TournamentSchema,
  type TournamentScreenValues,
} from "@/components/pages/tournaments/form-schema";
import { resolveTournamentFormInvalidSubmission } from "@/components/pages/tournaments/form-validation";
import { tournamentMediaFormDomain } from "@/lib/tournaments/tournament-form-store";
import { useCRPC, useCRPCClient } from "@/lib/convex/crpc";
import {
  MediaFormHost,
  useMediaFormController,
  type MediaFormController,
  type MediaFormControllerOptions,
} from "@/lib/forms/media-form-controller";
import type { TournamentFormTabValue } from "@/lib/tournaments/tournament-form-navigation";

export type TournamentFormControllerOptions = Omit<
  MediaFormControllerOptions<TournamentScreenValues>,
  | "domain"
  | "entityLabel"
  | "generateUploadUrl"
  | "onInvalidSubmit"
  | "resolver"
  | "toastScope"
> & {
  onValidationTabRequest: (tab: TournamentFormTabValue) => void;
};

export type TournamentFormController =
  MediaFormController<TournamentScreenValues>;

export function useTournamentFormController(
  options: TournamentFormControllerOptions
): TournamentFormController {
  const { onValidationTabRequest, ...rest } = options;
  const crpc = useCRPC();
  const crpcClient = useCRPCClient();
  const { toast } = useToast();
  const generateUploadUrl = useMutation({
    mutationFn: crpcClient.tournament.management.generateUploadUrl.mutate,
    mutationKey: crpc.tournament.management.generateUploadUrl.mutationKey(),
  });

  function handleInvalidSubmit(errors: FieldErrors<TournamentScreenValues>) {
    const invalidSubmission = resolveTournamentFormInvalidSubmission(errors);

    onValidationTabRequest(invalidSubmission.tab);
    toast.show({
      description: invalidSubmission.description,
      id: `tournament-form-validation-${invalidSubmission.tab}`,
      label: invalidSubmission.label,
      variant: "danger",
    });
  }

  return useMediaFormController<TournamentScreenValues>({
    ...rest,
    domain: tournamentMediaFormDomain,
    entityLabel: "o torneio",
    generateUploadUrl: async () => generateUploadUrl.mutateAsync({}),
    onInvalidSubmit: handleInvalidSubmit,
    resolver: zodResolver(TournamentSchema) as Resolver<TournamentScreenValues>,
    toastScope: "tournament",
  });
}

export { MediaFormHost as TournamentFormHost };
