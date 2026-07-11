import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ThreadParticipant } from "../schemas/tickets";

const MAX_VISIBLE_AVATARS = 3;

type ParticipantPerson = {
  userId: string;
  displayName: string;
  avatar: string | null;
  roles: string[];
};

function participantDisplayName(participant: ThreadParticipant) {
  return (
    participant.user?.username ??
    participant.user?.globalName ??
    participant.userId
  );
}

function discordAvatarUrl(userId: string, avatar: string | null) {
  if (!avatar) return undefined;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function roleLabel(role: string) {
  if (role === "staff") return "Staff";
  if (role === "user") return "Member";
  return role;
}

/** Collapse duplicate userId rows (member + staff) into one person with merged roles. */
function uniquePeople(participants: ThreadParticipant[]): ParticipantPerson[] {
  const byUserId = new Map<string, ParticipantPerson>();

  for (const participant of participants) {
    const existing = byUserId.get(participant.userId);
    if (existing) {
      if (!existing.roles.includes(participant.role)) {
        existing.roles.push(participant.role);
      }
      continue;
    }

    byUserId.set(participant.userId, {
      userId: participant.userId,
      displayName: participantDisplayName(participant),
      avatar: participant.user?.avatar ?? null,
      roles: [participant.role],
    });
  }

  return [...byUserId.values()].sort((left, right) => {
    const leftMember = left.roles.includes("user") ? 0 : 1;
    const rightMember = right.roles.includes("user") ? 0 : 1;
    if (leftMember !== rightMember) return leftMember - rightMember;
    return left.displayName.localeCompare(right.displayName);
  });
}

function summaryLabel(people: ParticipantPerson[]) {
  if (people.length === 0) return null;
  if (people.length === 1) return people[0].displayName;
  if (people.length === 2) {
    return `${people[0].displayName}, ${people[1].displayName}`;
  }
  return `${people[0].displayName} +${people.length - 1}`;
}

export function TicketHeaderParticipants({
  participants,
  fallbackUserId,
  className,
}: {
  participants: ThreadParticipant[] | undefined;
  fallbackUserId: string;
  className?: string;
}) {
  const people = uniquePeople(participants ?? []);
  const label = people.length > 1 ? "Participants" : "User";

  if (people.length === 0) {
    return (
      <span className={cn("min-w-0 text-sm text-muted-foreground", className)}>
        {label}:{" "}
        <span className="text-foreground">{fallbackUserId}</span>
      </span>
    );
  }

  const visible = people.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = people.length - visible.length;
  const text = summaryLabel(people)!;
  const interactive = people.length > 1;

  const trigger = (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-72 items-center gap-2 text-sm text-muted-foreground",
        interactive && "transition-colors hover:text-foreground",
      )}
    >
      <AvatarGroup className="shrink-0">
        {visible.map((person) => (
          <Avatar key={person.userId} size="sm">
            <AvatarImage
              src={discordAvatarUrl(person.userId, person.avatar)}
              alt={person.displayName}
            />
            <AvatarFallback>{initials(person.displayName)}</AvatarFallback>
          </Avatar>
        ))}
        {overflow > 0 ? (
          <AvatarGroupCount className="size-6 text-[10px]">
            +{overflow}
          </AvatarGroupCount>
        ) : null}
      </AvatarGroup>
      <span className="min-w-0 truncate">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground">{text}</span>
      </span>
    </span>
  );

  if (!interactive) {
    return <span className={className}>{trigger}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        className={cn(
          "min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0" side="bottom">
        <PopoverHeader className="border-b border-border px-3 py-2.5">
          <PopoverTitle>
            {people.length} participant{people.length === 1 ? "" : "s"}
          </PopoverTitle>
          <PopoverDescription>
            Members and staff on this ticket
          </PopoverDescription>
        </PopoverHeader>
        <ul className="max-h-64 overflow-y-auto p-1.5">
          {people.map((person) => (
            <li
              key={person.userId}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
            >
              <Avatar size="sm" className="shrink-0">
                <AvatarImage
                  src={discordAvatarUrl(person.userId, person.avatar)}
                  alt={person.displayName}
                />
                <AvatarFallback>{initials(person.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {person.displayName}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {person.roles.map((role) => (
                    <Badge key={role} variant="outline" className="capitalize">
                      {roleLabel(role)}
                    </Badge>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
