import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { authClient } from "@/lib/auth-client";
import { signInWithDiscord } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OnboardingShell } from "./onboarding-shell";
import { StepSidebar } from "./step-progress";
import {
  ChannelPicker,
  GuildMultiPicker,
  GuildPicker,
  StaffRolePermissionsEditor,
  staffLevelToPermissions,
  type StaffPermissionLevel,
} from "./guild-picker";
import {
  useClaimSetup,
  useCompleteSetup,
  useSaveChannelStrategy,
  useSaveRolePermissions,
  useSaveSetupGuilds,
  useSetupGuilds,
  useSetupResources,
  useSetupStatus,
  useRefreshSetupGuilds,
} from "../hooks/setup";
import type {
  ChannelStrategy,
  DiscordSetupGuild,
  LinkedGuildStatus,
  RolePermission,
  SetupPermission,
  SetupStatus,
} from "../schemas/setup";
import { cn } from "@/lib/utils";

const steps = [
  "Account",
  "Primary server",
  "More servers",
  "Bot invite",
  "Routing",
  "Staff roles",
  "Review",
] as const;

export function OnboardingFlow() {
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedMaxStep, setVisitedMaxStep] = useState(0);

  const setupStatus = useSetupStatus(Boolean(session.data));
  const setupGuilds = useSetupGuilds(Boolean(setupStatus.data?.isSetupOwner));
  const saveGuilds = useSaveSetupGuilds();
  const saveChannelStrategy = useSaveChannelStrategy();
  const saveRolePermissions = useSaveRolePermissions();
  const completeSetup = useCompleteSetup();

  const setupData = setupStatus.data;
  const linkedGuilds = setupData?.linkedGuilds ?? [];
  const availableGuilds = setupGuilds.data?.guilds ?? [];
  const needsReauth = Boolean(setupGuilds.data?.needsReauth);
  const savedPrimaryGuildId = setupData?.primaryGuildId ?? "";
  const linkedAdditionalGuildIds = useMemo(
    () => linkedAdditionalGuildSet(linkedGuilds),
    [linkedGuilds],
  );
  const linkedAdditionalGuildKey = useMemo(
    () => serializeGuildIdSet(linkedAdditionalGuildIds),
    [linkedAdditionalGuildIds],
  );

  const [primaryGuildDraft, setPrimaryGuildDraft] = useState(savedPrimaryGuildId);
  const [primaryDraftSyncKey, setPrimaryDraftSyncKey] = useState(savedPrimaryGuildId);
  const [additionalGuildDraft, setAdditionalGuildDraft] = useState(linkedAdditionalGuildIds);
  const [additionalDraftSyncKey, setAdditionalDraftSyncKey] = useState(linkedAdditionalGuildKey);

  const routingTargetGuild =
    linkedGuilds.find((guild) => !guild.channelStrategy) ?? linkedGuilds[0] ?? null;
  const routingTargetGuildId = routingTargetGuild?.guildId ?? "";
  const savedRoutingStrategy =
    (routingTargetGuild?.channelStrategy as ChannelStrategy | null) ?? "category";
  const savedRoutingChannelId =
    routingTargetGuild?.categoryChannelId ?? routingTargetGuild?.forumChannelId ?? "";

  const [routingStrategy, setRoutingStrategy] = useState<ChannelStrategy>(savedRoutingStrategy);
  const [routingChannelId, setRoutingChannelId] = useState(savedRoutingChannelId);
  const [routingDraftSyncKey, setRoutingDraftSyncKey] = useState(routingTargetGuildId);

  const staffTargetGuild =
    linkedGuilds.find((guild) =>
      !guild.rolePermissions.some((role) => role.permissions.includes("READ")),
    ) ??
    linkedGuilds[0] ??
    null;
  const staffTargetGuildId = staffTargetGuild?.guildId ?? "";
  const savedStaffRolePermissions = useMemo(
    () =>
      Object.fromEntries(
        (staffTargetGuild?.rolePermissions ?? []).map((role) => [role.roleId, role.permissions]),
      ),
    [staffTargetGuild],
  );

  const [staffRolePermissions, setStaffRolePermissions] =
    useState<Record<string, SetupPermission[]>>(savedStaffRolePermissions);
  const [staffDraftSyncKey, setStaffDraftSyncKey] = useState(staffTargetGuildId);

  if (primaryDraftSyncKey !== savedPrimaryGuildId) {
    setPrimaryDraftSyncKey(savedPrimaryGuildId);
    setPrimaryGuildDraft(savedPrimaryGuildId);
  }

  if (additionalDraftSyncKey !== linkedAdditionalGuildKey) {
    setAdditionalDraftSyncKey(linkedAdditionalGuildKey);
    setAdditionalGuildDraft(linkedAdditionalGuildIds);
  }

  if (routingDraftSyncKey !== routingTargetGuildId) {
    setRoutingDraftSyncKey(routingTargetGuildId);
    setRoutingStrategy(savedRoutingStrategy);
    setRoutingChannelId(savedRoutingChannelId);
  }

  if (staffDraftSyncKey !== staffTargetGuildId) {
    setStaffDraftSyncKey(staffTargetGuildId);
    setStaffRolePermissions(savedStaffRolePermissions);
  }

  const derivedMaxReachable = useMemo(
    () =>
      setupData ? deriveMaxReachable(setupData, linkedGuilds, availableGuilds) : 0,
    [setupData, linkedGuilds, availableGuilds],
  );
  const maxReachableStep = Math.max(visitedMaxStep, derivedMaxReachable);

  useEffect(() => {
    if (setupStatus.data?.complete) {
      navigate("/");
    }
  }, [navigate, setupStatus.data?.complete]);

  const sessionLoading = session.isPending && !session.data;
  const setupLoading = Boolean(session.data) && setupStatus.isPending;

  if (sessionLoading || setupLoading) {
    return (
      <OnboardingShell title="Loading" compact>
        <p className="text-sm text-muted-foreground">Checking your session…</p>
      </OnboardingShell>
    );
  }

  if (!session.data) {
    return (
      <OnboardingShell
        title="Sign in"
        description="Connect Discord to set up your modmail instance."
        compact
        footer={<Button onClick={() => signIn()}>Sign in with Discord</Button>}
      >
        <p className="text-sm text-muted-foreground">
          The first person to sign in can claim setup and link your servers.
        </p>
      </OnboardingShell>
    );
  }

  if (setupStatus.error) {
    return (
      <OnboardingShell title="Setup unavailable" compact>
        <ErrorMessage error={setupStatus.error} />
      </OnboardingShell>
    );
  }

  const status = setupStatus.data;
  if (!status) {
    return (
      <OnboardingShell title="Setup unavailable" compact>
        <p className="text-sm text-muted-foreground">Refresh the page and try again.</p>
      </OnboardingShell>
    );
  }

  const navigationContext = {
    status,
    linkedGuilds,
    guilds: availableGuilds,
    primaryGuildDraft,
    needsReauth,
    routingChannelId,
    routingTargetGuildId,
    staffRolePermissions,
    staffTargetGuildId,
  };

  const isSaving =
    saveGuilds.isPending ||
    saveChannelStrategy.isPending ||
    saveRolePermissions.isPending ||
    completeSetup.isPending;
  const canGoBack = currentStep > 0;
  const canGoNext =
    currentStep < steps.length - 1 && canAdvanceFromStep(currentStep, navigationContext) && !isSaving;
  const canComplete =
    currentStep === steps.length - 1 && status.missingRequirements.length === 0 && !isSaving;

  async function handleNext() {
    if (!canAdvanceFromStep(currentStep, navigationContext) || isSaving) {
      return;
    }

    try {
      if (currentStep === 1) {
        if (
          shouldSavePrimaryGuildSelection(
            status!,
            linkedGuilds,
            primaryGuildDraft,
            additionalGuildDraft,
          )
        ) {
          await saveGuilds.mutateAsync({
            primaryGuildId: primaryGuildDraft,
            additionalGuildIds: [...additionalGuildDraft].filter(
              (guildId) => guildId !== primaryGuildDraft,
            ),
          });
        }
      }

      if (currentStep === 2) {
        const primaryGuildId = status!.primaryGuildId;
        if (!primaryGuildId) return;

        if (hasAdditionalGuildDraftChanged(linkedGuilds, additionalGuildDraft)) {
          await saveGuilds.mutateAsync({
            primaryGuildId,
            additionalGuildIds: [...additionalGuildDraft],
          });
        }
      }

      if (currentStep === 4) {
        const incompleteGuild = linkedGuilds.find((guild) => !guild.channelStrategy);

        if (incompleteGuild) {
          if (!routingChannelId) return;

          if (
            hasRoutingDraftChanged(incompleteGuild, routingStrategy, routingChannelId)
          ) {
            const updated = await saveChannelStrategy.mutateAsync({
              guildId: incompleteGuild.guildId,
              strategy: routingStrategy,
              channelId: routingChannelId,
            });

            if (updated.linkedGuilds.some((guild) => !guild.channelStrategy)) {
              return;
            }
          }
        }
      }

      if (currentStep === 5) {
        const incompleteGuild = linkedGuilds.find((guild) =>
          !guild.rolePermissions.some((role) => role.permissions.includes("READ")),
        );

        if (incompleteGuild) {
          const selectedRoles = buildRolePermissionPayload(staffRolePermissions);
          if (!selectedRoles.some((role) => role.permissions.includes("READ"))) return;

          if (!rolePermissionsEqual(staffRolePermissions, incompleteGuild.rolePermissions)) {
            const updated = await saveRolePermissions.mutateAsync({
              guildId: incompleteGuild.guildId,
              roles: selectedRoles,
            });

            if (
              updated.linkedGuilds.some(
                (guild) =>
                  !guild.rolePermissions.some((role) => role.permissions.includes("READ")),
              )
            ) {
              return;
            }
          }
        }
      }

      const nextStep = Math.min(steps.length - 1, currentStep + 1);
      setCurrentStep(nextStep);
      setVisitedMaxStep((previous) => Math.max(previous, nextStep));
    } catch {
      // MutationError surfaces below the active step content.
    }
  }

  async function handleComplete() {
    if (!canComplete) return;

    try {
      await completeSetup.mutateAsync();
    } catch {
      // MutationError surfaces below the active step content.
    }
  }

  function handleBack() {
    setCurrentStep((step) => Math.max(0, step - 1));
  }

  function handleStepSelect(step: number) {
    if (step <= maxReachableStep) {
      setCurrentStep(step);
    }
  }

  return (
    <OnboardingShell
      title="Set up imi/tickets"
      sidebar={
        <StepSidebar
          steps={steps}
          currentStep={currentStep}
          maxReachableStep={maxReachableStep}
          onStepSelect={handleStepSelect}
        />
      }
      footer={
        <>
          <Button variant="ghost" disabled={!canGoBack} onClick={handleBack}>
            Back
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button variant="secondary" disabled={!canGoNext} onClick={() => void handleNext()}>
              {isSaving ? "Saving…" : "Next"}
            </Button>
          ) : (
            <Button disabled={!canComplete} onClick={() => void handleComplete()}>
              {completeSetup.isPending ? "Completing…" : "Complete"}
            </Button>
          )}
        </>
      }
    >
      {currentStep === 0 && <OwnerStep status={status} />}
      {currentStep === 1 && (
        <PrimaryGuildStep
          guilds={availableGuilds}
          needsReauth={needsReauth}
          value={primaryGuildDraft}
          onValueChange={setPrimaryGuildDraft}
          loading={setupGuilds.isFetching}
          saveError={saveGuilds.error}
        />
      )}
      {currentStep === 2 && (
        <AdditionalGuildsStep
          guilds={availableGuilds}
          primaryGuildId={status.primaryGuildId}
          selectedGuildIds={additionalGuildDraft}
          onSelectedGuildIdsChange={setAdditionalGuildDraft}
          loading={setupGuilds.isFetching}
          saveError={saveGuilds.error}
        />
      )}
      {currentStep === 3 && <BotInviteStep guilds={availableGuilds} linkedGuilds={linkedGuilds} />}
      {currentStep === 4 && (
        <ChannelStrategyStep
          targetGuild={routingTargetGuild}
          strategy={routingStrategy}
          channelId={routingChannelId}
          onStrategyChange={(strategy) => {
            setRoutingStrategy(strategy);
            setRoutingChannelId("");
          }}
          onChannelIdChange={setRoutingChannelId}
          saveError={saveChannelStrategy.error}
        />
      )}
      {currentStep === 5 && (
        <StaffRolesStep
          targetGuild={staffTargetGuild}
          rolePermissions={staffRolePermissions}
          onRolePermissionsChange={setStaffRolePermissions}
          saveError={saveRolePermissions.error}
        />
      )}
      {currentStep === 6 && (
        <ReviewStep
          linkedGuilds={linkedGuilds}
          missingRequirements={status.missingRequirements}
          completeError={completeSetup.error}
        />
      )}
    </OnboardingShell>
  );
}

function OwnerStep({ status }: { status: SetupStatus }) {
  const claimSetup = useClaimSetup();

  if (status.isSetupOwner) {
    return (
      <StepContent>
        <StepHeader
          title="Ownership claimed"
          description="You're the setup owner. Continue to link your primary server."
        />
      </StepContent>
    );
  }

  if (!status.canClaimSetup) {
    return (
      <StepContent>
        <StepHeader
          title="Setup in progress"
          description="Another user has already claimed setup for this instance."
        />
      </StepContent>
    );
  }

  return (
    <StepContent>
      <StepHeader
        title="Claim setup"
        description="You're the first user here. Claim ownership to configure this instance."
      />
      <div className="flex flex-col gap-3">
        <Button onClick={() => claimSetup.mutate()} disabled={claimSetup.isPending}>
          {claimSetup.isPending ? "Claiming…" : "Claim setup"}
        </Button>
        <MutationError error={claimSetup.error} />
      </div>
    </StepContent>
  );
}

function PrimaryGuildStep({
  guilds,
  needsReauth,
  value,
  onValueChange,
  loading,
  saveError,
}: {
  guilds: DiscordSetupGuild[];
  needsReauth: boolean;
  value: string;
  onValueChange: (guildId: string) => void;
  loading: boolean;
  saveError: unknown;
}) {
  if (needsReauth) {
    return <DiscordReauthPanel />;
  }

  return (
    <StepContent>
      <StepHeader
        title="Primary server"
        description="This is your main Discord server for tickets and staff access."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading servers…</p>
      ) : guilds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No administrator servers found on your Discord account.
        </p>
      ) : (
        <GuildPicker guilds={guilds} value={value} onValueChange={onValueChange} />
      )}

      <MutationError error={saveError} />
    </StepContent>
  );
}

function AdditionalGuildsStep({
  guilds,
  primaryGuildId,
  selectedGuildIds,
  onSelectedGuildIdsChange,
  loading,
  saveError,
}: {
  guilds: DiscordSetupGuild[];
  primaryGuildId: string | null;
  selectedGuildIds: Set<string>;
  onSelectedGuildIdsChange: (guildIds: Set<string>) => void;
  loading: boolean;
  saveError: unknown;
}) {
  if (!primaryGuildId) {
    return (
      <StepContent>
        <StepHeader title="More servers" description="Choose a primary server first." />
      </StepContent>
    );
  }

  const additionalGuilds = guilds.filter((guild) => guild.id !== primaryGuildId);

  return (
    <StepContent>
      <StepHeader
        title="More servers"
        description="Optional — add other servers to watch. You can add more later in settings."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading servers…</p>
      ) : additionalGuilds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other administrator servers found.</p>
      ) : (
        <GuildMultiPicker
          guilds={additionalGuilds}
          selectedGuildIds={selectedGuildIds}
          onSelectedGuildIdsChange={onSelectedGuildIdsChange}
        />
      )}

      <MutationError error={saveError} />
    </StepContent>
  );
}

function BotInviteStep({
  guilds,
  linkedGuilds,
}: {
  guilds: DiscordSetupGuild[];
  linkedGuilds: LinkedGuildStatus[];
}) {
  const refreshSetupGuilds = useRefreshSetupGuilds();
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <StepContent>
      <StepHeader
        title="Bot invite"
        description="The bot needs to be in every linked server before you can finish setup."
      />

      <div className="divide-y divide-border rounded-lg border border-border">
        {linkedGuilds.map((linkedGuild) => {
          const guild = guilds.find((item) => item.id === linkedGuild.guildId);
          const ready = Boolean(guild?.botPresent);

          return (
            <div
              key={linkedGuild.guildId}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{linkedGuild.name ?? linkedGuild.guildId}</div>
                <div className="text-muted-foreground">
                  {ready ? "Bot connected" : "Invite required"}
                </div>
              </div>
              {ready ? (
                <Badge variant="secondary">Ready</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => guild?.inviteUrl && window.open(guild.inviteUrl, "_blank", "noreferrer")}
                >
                  Invite
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="mt-2 w-fit px-0"
        disabled={isRefreshing}
        onClick={() => {
          setIsRefreshing(true);
          void refreshSetupGuilds().finally(() => setIsRefreshing(false));
        }}
      >
        {isRefreshing ? "Rechecking…" : "Recheck status"}
      </Button>
    </StepContent>
  );
}

function ChannelStrategyStep({
  targetGuild,
  strategy,
  channelId,
  onStrategyChange,
  onChannelIdChange,
  saveError,
}: {
  targetGuild: LinkedGuildStatus | null;
  strategy: ChannelStrategy;
  channelId: string;
  onStrategyChange: (strategy: ChannelStrategy) => void;
  onChannelIdChange: (channelId: string) => void;
  saveError: unknown;
}) {
  const resources = useSetupResources(targetGuild?.guildId ?? null, Boolean(targetGuild));

  if (!targetGuild) {
    return (
      <StepContent>
        <StepHeader title="Routing" description="Link a server first." />
      </StepContent>
    );
  }

  const channelOptions =
    strategy === "category"
      ? (resources.data?.categories ?? [])
      : (resources.data?.forums ?? []);
  const channelPlaceholder =
    strategy === "category" ? "Select a category" : "Select a forum channel";
  const channelSearchPlaceholder =
    strategy === "category" ? "Search categories…" : "Search forum channels…";

  return (
    <StepContent>
      <StepHeader
        title="Routing"
        description={`Choose where tickets are created in ${targetGuild.name ?? "this server"}.`}
      />

      {resources.isFetching ? (
        <p className="text-sm text-muted-foreground">
          {strategy === "category" ? "Loading categories…" : "Loading forum channels…"}
        </p>
      ) : resources.error ? (
        <ErrorMessage error={resources.error} />
      ) : (
        <>
          <RadioGroup
            value={strategy}
            onValueChange={(value) => onStrategyChange(value as ChannelStrategy)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border border-border p-4 transition-colors",
                strategy === "category" && "border-primary bg-muted/40",
              )}
            >
              <RadioGroupItem value="category" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">Category</span>
                <span className="text-sm text-muted-foreground">
                  The server category new ticket channels will be created under.
                </span>
              </div>
            </label>
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border border-border p-4 transition-colors",
                strategy === "forum" && "border-primary bg-muted/40",
              )}
            >
              <RadioGroupItem value="forum" className="mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-medium">Forum channel</span>
                <span className="text-sm text-muted-foreground">
                  Tickets are created as posts inside a forum channel.
                </span>
              </div>
            </label>
          </RadioGroup>

          <ChannelPicker
            channels={channelOptions}
            value={channelId}
            onValueChange={onChannelIdChange}
            placeholder={channelPlaceholder}
            searchPlaceholder={channelSearchPlaceholder}
            emptyMessage={
              strategy === "category" ? "No categories found." : "No forum channels found."
            }
          />
        </>
      )}

      <MutationError error={saveError} />
    </StepContent>
  );
}

function StaffRolesStep({
  targetGuild,
  rolePermissions,
  onRolePermissionsChange,
  saveError,
}: {
  targetGuild: LinkedGuildStatus | null;
  rolePermissions: Record<string, SetupPermission[]>;
  onRolePermissionsChange: (permissions: Record<string, SetupPermission[]>) => void;
  saveError: unknown;
}) {
  const resources = useSetupResources(targetGuild?.guildId ?? null, Boolean(targetGuild));

  if (!targetGuild) {
    return (
      <StepContent>
        <StepHeader title="Staff roles" description="Link a server first." />
      </StepContent>
    );
  }

  const roles = resources.data?.roles ?? [];

  return (
    <StepContent>
      <StepHeader
        title="Staff roles"
        description={`Choose which roles can access tickets in ${targetGuild.name ?? "this server"}.`}
      />

      {resources.isFetching ? (
        <p className="text-sm text-muted-foreground">Loading roles…</p>
      ) : resources.error ? (
        <ErrorMessage error={resources.error} />
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignable roles found in this server.</p>
      ) : (
        <StaffRolePermissionsEditor
          roles={roles}
          rolePermissions={rolePermissions}
          onPermissionLevelChange={(roleId, level) =>
            onRolePermissionsChange(setStaffPermissionLevel(rolePermissions, roleId, level))
          }
        />
      )}

      <MutationError error={saveError} />
    </StepContent>
  );
}

function ReviewStep({
  linkedGuilds,
  missingRequirements,
  completeError,
}: {
  linkedGuilds: LinkedGuildStatus[];
  missingRequirements: string[];
  completeError: unknown;
}) {
  return (
    <StepContent>
      <StepHeader
        title="Review"
        description="Confirm everything looks right, then finish setup."
      />

      <div className="divide-y divide-border rounded-lg border border-border text-sm">
        {linkedGuilds.map((guild) => (
          <div key={guild.guildId} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-medium">{guild.name ?? guild.guildId}</div>
              <div className="text-muted-foreground">
                {guild.channelStrategy ?? "No routing"} · {guild.rolePermissions.length} role
                {guild.rolePermissions.length === 1 ? "" : "s"}
              </div>
            </div>
            {guild.isPrimary && <Badge variant="secondary">Primary</Badge>}
          </div>
        ))}
      </div>

      {missingRequirements.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Still needed: {missingRequirements.join(", ")}
        </p>
      )}

      <MutationError error={completeError} />
    </StepContent>
  );
}

function StepContent({ children }: { children: ReactNode }) {
  return <section className="flex min-h-full flex-1 flex-col gap-5">{children}</section>;
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="font-heading text-lg font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function DiscordReauthPanel() {
  return (
    <StepContent>
      <StepHeader
        title="Discord access needed"
        description="Sign in again so we can list servers where you're an administrator."
      />
      <Button className="w-fit" onClick={() => signIn()}>
        Sign in with Discord
      </Button>
    </StepContent>
  );
}

function ErrorMessage({ error }: { error: unknown }) {
  if (error instanceof ApiError) {
    return <p className="text-sm text-muted-foreground">{error.message}</p>;
  }

  if (error instanceof Error && error.message) {
    return <p className="text-sm text-muted-foreground">{error.message}</p>;
  }

  return <p className="text-sm text-muted-foreground">Something went wrong.</p>;
}

function MutationError({ error }: { error: unknown }) {
  if (!error) return null;

  return <ErrorMessage error={error} />;
}

interface NavigationContext {
  status: SetupStatus;
  linkedGuilds: LinkedGuildStatus[];
  guilds: DiscordSetupGuild[];
  primaryGuildDraft: string;
  needsReauth: boolean;
  routingChannelId: string;
  routingTargetGuildId: string | null;
  staffRolePermissions: Record<string, SetupPermission[]>;
  staffTargetGuildId: string | null;
}

function canAdvanceFromStep(step: number, context: NavigationContext) {
  switch (step) {
    case 0:
      return context.status.isSetupOwner;
    case 1:
      return Boolean(context.primaryGuildDraft) && !context.needsReauth;
    case 2:
      return Boolean(context.status.primaryGuildId);
    case 3:
      return allBotsReady(context.linkedGuilds, context.guilds);
    case 4:
      return Boolean(context.routingTargetGuildId && context.routingChannelId);
    case 5:
      return (
        Boolean(context.staffTargetGuildId) &&
        Object.values(context.staffRolePermissions).some((permissions) =>
          permissions.includes("READ"),
        )
      );
    default:
      return false;
  }
}

function deriveMaxReachable(
  status: SetupStatus,
  linkedGuilds: LinkedGuildStatus[],
  guilds: DiscordSetupGuild[],
) {
  if (!status.isSetupOwner) return 0;

  let max = 1;

  if (status.primaryGuildId) max = 2;
  if (status.primaryGuildId && allBotsReady(linkedGuilds, guilds)) max = Math.max(max, 3);
  if (linkedGuilds.length > 0 && linkedGuilds.every((guild) => Boolean(guild.channelStrategy))) {
    max = Math.max(max, 4);
  }
  if (
    linkedGuilds.length > 0 &&
    linkedGuilds.every((guild) =>
      guild.rolePermissions.some((role) => role.permissions.includes("READ")),
    )
  ) {
    max = Math.max(max, 5);
  }
  if (status.missingRequirements.length === 0 && linkedGuilds.length > 0) {
    max = Math.max(max, 6);
  }

  return max;
}

function allBotsReady(linkedGuilds: LinkedGuildStatus[], guilds: DiscordSetupGuild[]) {
  if (linkedGuilds.length === 0) return false;

  return linkedGuilds.every((linkedGuild) =>
    Boolean(guilds.find((guild) => guild.id === linkedGuild.guildId)?.botPresent),
  );
}

function buildRolePermissionPayload(
  rolePermissions: Record<string, SetupPermission[]>,
): RolePermission[] {
  return Object.entries(rolePermissions)
    .filter(([, permissions]) => permissions.length > 0)
    .map(([roleId, permissions]) => ({ roleId, permissions }));
}

function linkedAdditionalGuildSet(linkedGuilds: LinkedGuildStatus[]) {
  return new Set(linkedGuilds.filter((guild) => !guild.isPrimary).map((guild) => guild.guildId));
}

function serializeGuildIdSet(guildIds: Set<string>) {
  return [...guildIds].sort().join(",");
}

function setsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;

  for (const value of left) {
    if (!right.has(value)) return false;
  }

  return true;
}

function shouldSavePrimaryGuildSelection(
  status: SetupStatus,
  linkedGuilds: LinkedGuildStatus[],
  primaryGuildDraft: string,
  additionalGuildDraft: Set<string>,
) {
  if (primaryGuildDraft !== (status.primaryGuildId ?? "")) {
    return true;
  }

  const linkedAdditional = linkedAdditionalGuildSet(linkedGuilds);
  const draftAdditional = new Set(
    [...additionalGuildDraft].filter((guildId) => guildId !== primaryGuildDraft),
  );

  return !setsEqual(linkedAdditional, draftAdditional);
}

function hasAdditionalGuildDraftChanged(
  linkedGuilds: LinkedGuildStatus[],
  additionalGuildDraft: Set<string>,
) {
  return !setsEqual(linkedAdditionalGuildSet(linkedGuilds), additionalGuildDraft);
}

function getSavedRoutingChannelId(guild: LinkedGuildStatus) {
  return guild.categoryChannelId ?? guild.forumChannelId ?? "";
}

function hasRoutingDraftChanged(
  guild: LinkedGuildStatus,
  strategy: ChannelStrategy,
  channelId: string,
) {
  const savedStrategy = (guild.channelStrategy as ChannelStrategy | null) ?? "category";
  const savedChannelId = getSavedRoutingChannelId(guild);

  return strategy !== savedStrategy || channelId !== savedChannelId;
}

function normalizePermissionList(permissions: SetupPermission[]) {
  return [...permissions].sort();
}

function rolePermissionsEqual(
  draft: Record<string, SetupPermission[]>,
  saved: RolePermission[],
) {
  const savedMap = Object.fromEntries(
    saved.map((role) => [role.roleId, normalizePermissionList(role.permissions)]),
  );
  const draftMap = Object.fromEntries(
    Object.entries(draft)
      .filter(([, permissions]) => permissions.length > 0)
      .map(([roleId, permissions]) => [roleId, normalizePermissionList(permissions)]),
  );
  const roleIds = new Set([...Object.keys(savedMap), ...Object.keys(draftMap)]);

  for (const roleId of roleIds) {
    const draftPermissions = draftMap[roleId] ?? [];
    const savedPermissions = savedMap[roleId] ?? [];

    if (draftPermissions.length !== savedPermissions.length) {
      return false;
    }

    if (draftPermissions.some((permission, index) => permission !== savedPermissions[index])) {
      return false;
    }
  }

  return true;
}

function setStaffPermissionLevel(
  current: Record<string, SetupPermission[]>,
  roleId: string,
  level: StaffPermissionLevel,
): Record<string, SetupPermission[]> {
  return { ...current, [roleId]: staffLevelToPermissions(level) };
}

function signIn() {
  signInWithDiscord("/onboarding");
}
