import { api } from "@/lib/api";
import {
  setupGuildsResponseSchema,
  setupResourcesSchema,
  setupStatusSchema,
  type ChannelStrategy,
  type RolePermission,
} from "../schemas/setup";

export async function fetchSetupStatus() {
  return setupStatusSchema.parse(await api.get("/setup/status"));
}

export async function claimSetup() {
  return setupStatusSchema.parse(await api.post("/setup/claim"));
}

export async function fetchSetupGuilds(options?: { refresh?: boolean }) {
  const query = options?.refresh ? "?refresh=true" : "";

  return setupGuildsResponseSchema.parse(await api.get(`/setup/guilds${query}`));
}

export async function saveSetupGuilds(input: {
  primaryGuildId: string;
  additionalGuildIds: string[];
}) {
  return setupStatusSchema.parse(await api.post("/setup/guilds", input));
}

export async function fetchSetupResources(guildId: string) {
  return setupResourcesSchema.parse(
    await api.get(`/setup/guilds/${guildId}/resources`),
  );
}

export async function saveChannelStrategy(input: {
  guildId: string;
  strategy: ChannelStrategy;
  channelId: string;
}) {
  return setupStatusSchema.parse(
    await api.patch(`/setup/guilds/${input.guildId}/channel-strategy`, {
      strategy: input.strategy,
      channelId: input.channelId,
    }),
  );
}

export async function saveRolePermissions(input: {
  guildId: string;
  roles: RolePermission[];
}) {
  return setupStatusSchema.parse(
    await api.put(`/setup/guilds/${input.guildId}/roles`, {
      roles: input.roles,
    }),
  );
}

export async function completeSetup() {
  return setupStatusSchema.parse(await api.post("/setup/complete"));
}
