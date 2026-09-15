import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import type { FieldErrors, Resolver } from "react-hook-form";

import {
  LeagueSchema,
  type LeagueScreenValues,
} from "@/components/pages/leagues/form-schema";
import { resolveLeagueFormInvalidSubmission } from "@/components/pages/leagues/form-validation";
import { leagueMediaFormDomain } from "@/lib/leagues/league-form-store";
import { useCRPC } from "@/lib/convex/crpc";
import {
  MediaFormHost,
  useMediaFormController,
  type MediaFormController,
  type MediaFormControllerOptions,
} from "@/lib/forms/media-form-controller";
import type { LeagueFormTabValue } from "@/lib/leagues/league-form-navigation";

export type LeagueFormControllerOptions = Omit<
  MediaFormControllerOptions<LeagueScreenValues>,
  | "domain"
  | "entityLabel"
  | "generateUploadUrl"
  | "onInvalidSubmit"
  | "resolver"
  | "toastScope"
> & {
  onValidationTabRequest: (tab: LeagueFormTabValue) => void;
};

export type LeagueFormController = MediaFormController<LeagueScreenValues>;

export function useLeagueFormController(
  options: LeagueFormControllerOptions
): LeagueFormController {
  const { onValidationTabRequest, ...rest } = options;
  const crpc = useCRPC();
  const { toast } = useToast();
  const generateUploadUrl = useMutation(
    crpc.league.management.generateUploadUrl.mutationOptions()
  );

  function handleInvalidSubmit(errors: FieldErrors<LeagueScreenValues>) {
    const invalidSubmission = resolveLeagueFormInvalidSubmission(errors);

    onValidationTabRequest(invalidSubmission.tab);
    toast.show({
      description: invalidSubmission.description,
      id: `league-form-validation-${invalidSubmission.tab}`,
      label: invalidSubmission.label,
      variant: "danger",
    });
  }

  return useMediaFormController<LeagueScreenValues>({
    ...rest,
    domain: leagueMediaFormDomain,
    entityLabel: "a liga",
    generateUploadUrl: async () => generateUploadUrl.mutateAsync({}),
    onInvalidSubmit: handleInvalidSubmit,
    resolver: zodResolver(LeagueSchema) as Resolver<LeagueScreenValues>,
    toastScope: "league",
  });
}

export { MediaFormHost as LeagueFormHost };
