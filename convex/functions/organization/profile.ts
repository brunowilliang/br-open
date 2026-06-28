import { eq, type InferSelectModel } from "kitcn/orm";
import type { Id } from "../../functions/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../functions/generated/server";
import { z } from "zod";
import { organization } from "../../domains/auth/tables";
import {
  collectReplacedLogoStorageIds,
  organizationMetadataSchema,
  organizationOutputSchema,
  upsertOrganizationSchema,
} from "../../domains/organization/contract";
import { authMutation, authQuery } from "../../lib/crpc";
import { requireActiveManager } from "../viewer/context";

type OrganizationRecord = InferSelectModel<typeof organization>;

async function resolveOrganizationLogoUrl(
  ctx: QueryCtx | MutationCtx,
  storageId?: null | string
) {
  if (!storageId) {
    return null;
  }

  try {
    return await ctx.storage.getUrl(storageId as Id<"_storage">);
  } catch {
    return null;
  }
}

function serializeOrganization(
  record: OrganizationRecord,
  logoUrl: null | string
) {
  const parsedMetadata = organizationMetadataSchema.parse(
    record.metadata ?? {}
  );

  return organizationOutputSchema.parse({
    acceptedTerms: parsedMetadata.acceptedTerms ?? null,
    address: parsedMetadata.address ?? null,
    contactEmail: parsedMetadata.contactEmail ?? null,
    description: parsedMetadata.description ?? null,
    id: record.id,
    logoStorageId: record.logo ?? null,
    logoUrl,
    name: record.name,
    organizerType: parsedMetadata.organizerType ?? null,
    organizerTypeLabel: parsedMetadata.organizerTypeLabel ?? null,
    phone: parsedMetadata.phone ?? null,
    slug: record.slug,
    sports: parsedMetadata.sports ?? null,
    sportsLabel: parsedMetadata.sportsLabel ?? null,
    website: parsedMetadata.website ?? null,
  });
}

async function deleteOrganizationLogoStorageIds(
  ctx: MutationCtx,
  storageIds: string[]
) {
  for (const storageId of storageIds) {
    await ctx.storage.delete(storageId as Id<"_storage">);
  }
}

export const get = authQuery
  .output(organizationOutputSchema.nullable())
  .query(async ({ ctx }) => {
    const organizationId = await requireActiveManager(ctx);
    const currentOrganization = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });

    if (!currentOrganization) {
      return null;
    }

    const logoUrl = await resolveOrganizationLogoUrl(
      ctx,
      currentOrganization.logo
    );

    return serializeOrganization(currentOrganization, logoUrl);
  });

export const generateUploadUrl = authMutation
  .output(z.string())
  .mutation(async ({ ctx }) => ctx.storage.generateUploadUrl());

export const upsert = authMutation
  .input(upsertOrganizationSchema)
  .output(organizationOutputSchema)
  .mutation(async ({ ctx, input }) => {
    const organizationId = await requireActiveManager(ctx);
    const currentOrganization = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });

    if (!currentOrganization) {
      throw new Error("Organization was not found.");
    }

    const now = new Date();
    const replacedStorageIds = collectReplacedLogoStorageIds({
      next: { logoStorageId: input.logoStorageId ?? null },
      previous: { logoStorageId: currentOrganization.logo ?? null },
    });

    const metadata = organizationMetadataSchema.parse(
      currentOrganization.metadata ?? {}
    );

    await ctx.orm
      .update(organization)
      .set({
        logo: input.logoStorageId ?? null,
        metadata: {
          ...metadata,
          address: input.address ?? null,
          contactEmail: input.contactEmail ?? null,
          description: input.description ?? null,
          organizerType: input.organizerType,
          organizerTypeLabel: input.organizerTypeLabel ?? null,
          phone: input.phone ?? null,
          sports: input.sports ?? null,
          sportsLabel: input.sportsLabel ?? null,
          website: input.website ?? null,
        },
        name: input.name,
        updatedAt: now,
      })
      .where(eq(organization.id, organizationId));

    await deleteOrganizationLogoStorageIds(ctx, replacedStorageIds);

    const updatedOrganization = await ctx.orm.query.organization.findFirst({
      where: { id: organizationId },
    });

    if (!updatedOrganization) {
      throw new Error("Organization was not found after update.");
    }

    const logoUrl = await resolveOrganizationLogoUrl(
      ctx,
      updatedOrganization.logo
    );

    return serializeOrganization(updatedOrganization, logoUrl);
  });
