import { z } from "zod";

import { actorKindSchema } from "../auth/actor-context";
import { pendingActionSchema } from "../pendings/contract";
import { NOTIFICATION_EVENT_TYPES } from "../../shared/notifications/protocol";
import type {
  NotificationPermissionStatus,
  PushReadinessReason,
} from "./state";

export const NotificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);

export const NotificationPermissionStatusSchema = z.enum([
  "denied",
  "granted",
  "undetermined",
] satisfies [NotificationPermissionStatus, ...NotificationPermissionStatus[]]);

export const NotificationReadinessReasonSchema = z.enum([
  "missing_device",
  "permission_denied",
  "permission_undetermined",
  "preference_disabled",
  "ready",
] satisfies [PushReadinessReason, ...PushReadinessReason[]]);

export const NotificationDeliveryStateSchema = z.enum([
  "awaiting_delivery",
  "in_progress",
  "delivered",
  "needs_retry",
  "failed",
  "maybe_delivered",
  "unable_to_deliver",
]);

export const NotificationDevicePlatformSchema = z.enum([
  "android",
  "ios",
  "web",
]);

/**
 * Apresentacao acionavel do item da central (IBX-0077 / PLN-0009): o servidor
 * decide SE o item tem botao, QUAL acao cada botao executa e QUAL palavra do
 * corpo vai em negrito — a tela so renderiza, nunca infere por `eventType`
 * (mesma regra do item de pendencias, `../pendings/contract.ts`).
 *
 * `null` = item INFORMATIVO (a maioria dos 44 eventos): a tela desenha o cartao
 * de hoje, sem botao. Linha antiga (criada antes deste campo) tambem chega
 * `null`, entao o app cai no cartao informativo sem nenhuma migration.
 *
 * O `action`/`secondaryAction` reusam o MESMO schema e o MESMO enum do modulo
 * de pendencias (`pendingActionSchema`) — um so vocabulario de acao no repo.
 */
export const notificationPresentationSchema = z.object({
  /** Acao do botao principal; `null` so em apresentacao sem decisao. */
  action: pendingActionSchema.nullable(),
  /** Rotulo do botao principal, portugues, uma palavra quando couber. */
  actionLabel: z.string().min(1).nullable(),
  /**
   * Trechos LITERAIS do `body` que vao em negrito no app (pode ser vazio). O
   * servidor so marca palavra que existe no texto — quem renderiza nunca
   * procura por conta propria.
   */
  bodyHighlights: z.array(z.string().min(1)),
  /** Acao do botao secundario do par (ex.: `Recusar`). */
  secondaryAction: pendingActionSchema.nullable(),
  /** Rotulo do botao secundario. */
  secondaryActionLabel: z.string().min(1).nullable(),
});

export const notificationFeedItemSchema = z.object({
  actorUserId: z.string().nullable(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()),
  eventType: NotificationEventTypeSchema,
  id: z.string(),
  isRead: z.boolean(),
  occurredAt: z.number(),
  presentation: notificationPresentationSchema.nullable(),
  readAt: z.number().nullable(),
  recipientActorKind: actorKindSchema,
  recipientOrganizationId: z.string().nullable(),
  recipientPlayerProfileId: z.string().nullable(),
  recipientUserId: z.string(),
  retractedAt: z.number().nullable(),
  sourceEntityId: z.string().nullable(),
  sourceEntityType: z.string().nullable(),
  status: z.enum(["active", "retracted"]).default("active"),
  title: z.string(),
});

export const notificationStatusSchema = z.object({
  canReceivePush: z.boolean(),
  deviceCount: z.number().int().nonnegative(),
  permissionStatus: NotificationPermissionStatusSchema,
  pushEnabled: z.boolean(),
  readinessReason: NotificationReadinessReasonSchema,
  unreadCount: z.number().int().nonnegative(),
});

export const SetNotificationPreferenceSchema = z.object({
  pushEnabled: z.boolean(),
});

export const UpsertNotificationDeviceSchema = z.object({
  expoPushToken: z.string().min(1),
  permissionStatus: NotificationPermissionStatusSchema,
  platform: NotificationDevicePlatformSchema,
});

export const MarkNotificationReadSchema = z.object({
  notificationId: z.string().min(1),
});

export const RemoveNotificationSchema = z.object({
  notificationId: z.string().min(1),
});

export const ListNotificationsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export type NotificationFeedItem = z.infer<typeof notificationFeedItemSchema>;
export type NotificationPresentation = z.infer<
  typeof notificationPresentationSchema
>;
export type NotificationPresentationAction = NonNullable<
  NotificationPresentation["action"]
>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
