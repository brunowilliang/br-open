import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { useCRPC } from "@/lib/convex/crpc";
import {
  registerForPushNotificationsAsync,
  registerNotificationCategoriesAsync,
} from "@/lib/notifications/expo-notifications";
import {
  type NotificationResponseIntent,
  resolveNotificationResponseIntent,
} from "@/lib/notifications/response-intent";

type NotificationBootstrapProps = {
  isEnabled: boolean;
};

export function NotificationBootstrap(props: NotificationBootstrapProps) {
  const crpc = useCRPC();
  const queryClient = useQueryClient();
  const handledResponseKey = useRef<string | null>(null);
  const lastSyncedToken = useRef<string | null>(null);
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
  const markRead = useMutation(
    crpc.notification.feed.markRead.mutationOptions()
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
      } catch {
        return;
      }
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
        await markNotificationRead(intent.notificationId);
        openNotificationUrl(intent.url);
        return;
      }

      if (intent.kind === "approveLeagueMembership") {
        await approveMembership.mutateAsync({
          leagueId: intent.leagueId,
          membershipId: intent.membershipId,
        });
        await markNotificationRead(intent.notificationId);
        await invalidateLeagueContext(intent.leagueId);
        openNotificationUrl(intent.url);
        return;
      }

      await rejectMembership.mutateAsync({
        leagueId: intent.leagueId,
        membershipId: intent.membershipId,
      });
      await markNotificationRead(intent.notificationId);
      await invalidateLeagueContext(intent.leagueId);
    },
    [
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
    if (!(props.isEnabled && statusQuery.data?.pushEnabled)) {
      return;
    }

    let isCancelled = false;

    async function syncDevice() {
      const registration = await registerForPushNotificationsAsync({
        requestPermission: false,
      });

      if (
        isCancelled ||
        !registration.expoPushToken ||
        registration.expoPushToken === lastSyncedToken.current
      ) {
        return;
      }

      lastSyncedToken.current = registration.expoPushToken;
      upsertDevice.mutate({
        expoPushToken: registration.expoPushToken,
        permissionStatus: registration.permissionStatus,
        platform: registration.platform,
      });
    }

    syncDevice().catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [props.isEnabled, statusQuery.data?.pushEnabled, upsertDevice]);

  return null;
}
