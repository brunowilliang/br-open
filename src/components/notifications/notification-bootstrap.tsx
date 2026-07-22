import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import type { ApiOutputs } from "@convex/shared/api";
import { applyViewerContextToClientState } from "@/lib/convex/actor-scoped-cache";
import { useCRPC } from "@/lib/convex/crpc";
import {
  registerForPushNotificationsAsync,
  registerNotificationCategoriesAsync,
} from "@/lib/notifications/expo-notifications";
import { shouldRequestPushPermission } from "@/lib/notifications/notification-permission-rules";
import {
  type NotificationResponseActor,
  type NotificationResponseIntent,
  resolveNotificationResponseIntent,
} from "@/lib/notifications/response-intent";

type NotificationBootstrapProps = {
  isEnabled: boolean;
};

type ViewerContext = ApiOutputs["viewer"]["context"]["get"];

export function NotificationBootstrap(props: NotificationBootstrapProps) {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const handledResponseKey = useRef<string | null>(null);
  const lastSyncedToken = useRef<string | null>(null);
  const hasRequestedPushPermission = useRef(false);
  const statusQuery = useQuery({
    ...crpc.notification.settings.status.queryOptions(),
    enabled: props.isEnabled,
  });
  const upsertDevice = useMutation(
    crpc.notification.settings.upsertDevice.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          crpc.notification.settings.status.queryFilter()
        );
      },
    })
  );
  const setPreference = useMutation(
    crpc.notification.settings.setPreference.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          crpc.notification.settings.status.queryFilter()
        );
      },
    })
  );
  const markRead = useMutation(
    crpc.notification.feed.markRead.mutationOptions()
  );
  const setActiveActor = useMutation(
    crpc.viewer.context.setActiveActor.mutationOptions()
  );
  const approveMembership = useMutation(
    crpc.league.membership.approve.mutationOptions()
  );
  const rejectMembership = useMutation(
    crpc.league.membership.reject.mutationOptions()
  );

  const invalidateNotifications = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries(
        crpc.notification.settings.status.queryFilter()
      ),
      queryClient.invalidateQueries(
        crpc.notification.feed.list.queryFilter({ limit: 50 })
      ),
    ]);
  }, [crpc, queryClient]);

  const invalidateActorContext = useCallback(
    async (viewerContext?: ViewerContext) => {
      if (viewerContext) {
        applyViewerContextToClientState({
          queryClient,
          viewerContext,
          viewerContextFilter: crpc.viewer.context.get.queryFilter(),
        });
      }

      await Promise.all([
        queryClient.invalidateQueries(crpc.viewer.context.get.queryFilter()),
        queryClient.invalidateQueries(
          crpc.notification.settings.status.queryFilter()
        ),
        queryClient.invalidateQueries(
          crpc.notification.feed.list.queryFilter({ limit: 50 })
        ),
        queryClient.invalidateQueries(
          crpc.league.discovery.listParticipating.queryFilter()
        ),
        queryClient.invalidateQueries(
          crpc.league.management.listMine.queryFilter()
        ),
      ]);
    },
    [crpc, queryClient]
  );

  const activateNotificationActor = useCallback(
    async (actor?: NotificationResponseActor) => {
      if (!actor) {
        return;
      }

      const viewerContext =
        actor.kind === "organization"
          ? await setActiveActor.mutateAsync({
              actorKind: "organization",
              organizationId: actor.organizationId,
            })
          : await setActiveActor.mutateAsync({ actorKind: "player" });

      await invalidateActorContext(viewerContext);
    },
    [invalidateActorContext, setActiveActor]
  );

  const invalidateLeagueContext = useCallback(
    async (leagueId: string) => {
      await Promise.all([
        queryClient.invalidateQueries(
          crpc.league.discovery.getById.queryFilter({ leagueId })
        ),
        queryClient.invalidateQueries(
          crpc.league.membership.getOverview.queryFilter({ leagueId })
        ),
        queryClient.invalidateQueries(
          crpc.league.challenges.listForLeague.queryFilter({ leagueId })
        ),
        queryClient.invalidateQueries(
          crpc.league.challenges.listOccupiedSlots.queryFilter({ leagueId })
        ),
      ]);
    },
    [crpc, queryClient]
  );

  const markNotificationRead = useCallback(
    async (notificationId?: string) => {
      if (!notificationId) {
        return;
      }

      try {
        await markRead.mutateAsync({ notificationId });
        await invalidateNotifications();
      } catch {}
    },
    [invalidateNotifications, markRead]
  );

  const openNotificationUrl = useCallback((url: string | null) => {
    if (url) {
      router.navigate(url as Href);
    }
  }, []);

  const handleIntent = useCallback(
    async (intent: NotificationResponseIntent) => {
      if (intent.kind === "open") {
        await activateNotificationActor(intent.recipientActor);
        await markNotificationRead(intent.notificationId);
        openNotificationUrl(intent.url);
        return;
      }

      if (intent.kind === "approveLeagueMembership") {
        await activateNotificationActor(intent.recipientActor);
        await approveMembership.mutateAsync({
          leagueId: intent.leagueId,
          membershipId: intent.membershipId,
        });
        await markNotificationRead(intent.notificationId);
        await invalidateLeagueContext(intent.leagueId);
        openNotificationUrl(intent.url);
        return;
      }

      await activateNotificationActor(intent.recipientActor);
      await rejectMembership.mutateAsync({
        leagueId: intent.leagueId,
        membershipId: intent.membershipId,
      });
      await markNotificationRead(intent.notificationId);
      await invalidateLeagueContext(intent.leagueId);
    },
    [
      activateNotificationActor,
      approveMembership,
      invalidateLeagueContext,
      markNotificationRead,
      openNotificationUrl,
      rejectMembership,
    ]
  );

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;

      if (handledResponseKey.current === responseKey) {
        return;
      }

      handledResponseKey.current = responseKey;
      const intent = resolveNotificationResponseIntent({
        actionIdentifier: response.actionIdentifier,
        data: response.notification.request.content.data ?? {},
      });

      handleIntent(intent).catch(() => undefined);
    },
    [handleIntent]
  );

  useEffect(() => {
    registerNotificationCategoriesAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!props.isEnabled) {
      return;
    }

    const response = Notifications.getLastNotificationResponse();

    if (response) {
      handleNotificationResponse(response);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (nextResponse) => {
        handleNotificationResponse(nextResponse);
      }
    );

    return () => {
      subscription.remove();
    };
  }, [handleNotificationResponse, props.isEnabled]);

  useEffect(() => {
    if (
      !props.isEnabled ||
      statusQuery.isPending ||
      statusQuery.isError ||
      !statusQuery.data
    ) {
      return;
    }

    let isCancelled = false;
    const requestPermission =
      !hasRequestedPushPermission.current &&
      shouldRequestPushPermission(statusQuery.data);

    if (requestPermission) {
      hasRequestedPushPermission.current = true;
    }

    async function syncDevice() {
      const registration = await registerForPushNotificationsAsync({
        requestPermission,
      });

      if (
        isCancelled ||
        !registration.expoPushToken ||
        registration.expoPushToken === lastSyncedToken.current
      ) {
        return;
      }

      // Persist the token to the backend BEFORE caching it locally, so a
      // transient failure (network blip, 5xx) leaves lastSyncedToken untouched
      // and the next effect run retries the upsert.
      await upsertDevice.mutateAsync({
        expoPushToken: registration.expoPushToken,
        permissionStatus: registration.permissionStatus,
        platform: registration.platform,
      });

      if (requestPermission && !statusQuery.data?.pushEnabled) {
        await setPreference.mutateAsync({ pushEnabled: true });
      }

      lastSyncedToken.current = registration.expoPushToken;
    }

    syncDevice().catch((error) => {
      console.warn("notification-bootstrap: device sync failed", error);
    });

    return () => {
      isCancelled = true;
    };
  }, [
    props.isEnabled,
    setPreference,
    statusQuery.data,
    statusQuery.isError,
    statusQuery.isPending,
    upsertDevice,
  ]);

  return null;
}
