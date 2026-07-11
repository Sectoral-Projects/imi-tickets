import { Link } from "react-router";
import {
  Bot,
  Command,
  Layers,
  Lock,
  MessageSquare,
  Radio,
  Server,
  Shield,
  Sparkles,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeatureShowcase } from "./feature-showcase";

const MORE_FEATURES = [
  {
    icon: Bot,
    title: "Discord modmail bot",
    description:
      "Members open tickets through DMs. Staff work from Discord channels or forum posts while the bot relays messages both ways.",
  },
  {
    icon: Server,
    title: "Multi-server onboarding",
    description:
      "Link a primary guild, watch additional servers, invite the bot, pick category or forum routing, and map staff roles in a guided first-run flow.",
  },
  {
    icon: Shield,
    title: "Server-aware RBAC",
    description:
      "Modular READ, MANAGE, and ADMIN permissions per linked Discord server, enforced on every product API route — not just in the UI.",
  },
  {
    icon: Radio,
    title: "Realtime ticket updates",
    description:
      "WebSocket events keep the ticket list and open conversations fresh while staff are working in the browser.",
  },
  {
    icon: MessageSquare,
    title: "DM open buttons & modals",
    description:
      "Prompt members with custom buttons before a ticket opens, collect modal form answers, and forward rendered templates to staff.",
  },
  {
    icon: Command,
    title: "Template staff commands",
    description:
      "Assign a command name to any custom message template, then send it from Discord with your bot prefix — including automatic delivery to every member DM when used inside a ticket.",
  },
  {
    icon: Users,
    title: "Staff open profile",
    description:
      "Optional Component V2 member summary in the staff channel before the first relayed message — join date, roles, prior tickets, and more.",
  },
  {
    icon: Timer,
    title: "Auto-close & reminders",
    description:
      "Configurable inactivity timeouts, reminder DMs before closure, and optional closed-ticket tagging.",
  },
  {
    icon: Lock,
    title: "Block & unblock flows",
    description:
      "Block users or roles from opening tickets, with shared enforcement across DMs, buttons, and staff commands.",
  },
  {
    icon: Sparkles,
    title: "Rich message media",
    description:
      "Inline images, hosted video, YouTube and veed.io embeds, link previews, forwarded-message frames, and file attachments in the transcript.",
  },
  {
    icon: Layers,
    title: "Unified audit timeline",
    description:
      "Lifecycle markers for opened, closed, reopened, and tag changes sit alongside messages in one chronological view.",
  },
  {
    icon: Zap,
    title: "Message deep linking",
    description:
      "Jump to highlighted messages inside a ticket with virtualized scrolling and local window loading around targets.",
  },
] as const;

export function FeaturesContent() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex max-w-3xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit">
            Product tour
          </Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything imi/tickets ships today
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            A self-hosted Discord modmail stack with a staff web UI, a Sapphire
            bot, custom RBAC, template builder, and analytics — built for teams
            that need private support without losing history.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button render={<Link to="/" />}>Open tickets</Button>
            <Button variant="outline" render={<Link to="/about" />}>
              What is imi/tickets?
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-20">
          <FeatureShowcase
            title="Ticket inbox with infinite scroll"
            description="Search, filter by status, and browse every open or closed conversation from one virtualized list that stays fast even as your queue grows."
            bullets={[
              "Live search and open/closed status filters",
              "Infinite scroll with TanStack Virtual for large queues",
              "Member identity snapshots on every card",
              "One click into the full ticket transcript",
            ]}
            imageSrc="/tickets-list.png"
            imageAlt="imi/tickets ticket list with search, status filter, and ticket cards"
          />

          <FeatureShowcase
            title="Full ticket timeline in the browser"
            description="Read the entire conversation — member DMs, staff replies, system events, and audit markers — in a single scrollable transcript designed for long tickets."
            bullets={[
              "DM, Staff, and System source badges on every message group",
              "Lifecycle markers for opened and closed events",
              "Modal responses, markdown content, and rich media embeds",
              "Deep-link highlighting to jump straight to a message",
            ]}
            imageSrc="/ticket.png"
            imageAlt="imi/tickets ticket detail view with message timeline and audit markers"
            reverse
          />

          <FeatureShowcase
            title="Staff analytics dashboard"
            description="Measure who is handling tickets, how active your team is, and how workload trends over time — without exporting spreadsheets."
            bullets={[
              "Overview metrics for total tickets and in-progress count",
              "Top staff podium ranked by tickets handled",
              "Daily activity chart for messages and staff actions",
              "Per-member cards with closes, reopens, notes, and last active date",
            ]}
            imageSrc="/staff-analytics.png"
            imageAlt="imi/tickets staff analytics page with charts and staff member cards"
          />

          <FeatureShowcase
            title="General settings that shape ticket behavior"
            description="Tune privacy, automation, and staff-only affordances from one settings surface — no bot restarts required for most changes."
            bullets={[
              "Anonymous staff replies and optional typing indicators in member DMs",
              "Staff-only member profile card when a ticket channel opens",
              "Auto-close after inactivity with reminder DMs beforehand",
              "Optional new-ticket notifications and auto-tagging on close",
            ]}
            imageSrc="/settings-general.png"
            imageAlt="imi/tickets general settings for privacy and ticket automation"
            reverse
          />

          <FeatureShowcase
            title="Component V2 template builder"
            description="Customize every bot-facing message with a visual editor, live Discord-style preview, variables, accent colors, buttons, and modal forms."
            bullets={[
              "Drag-and-drop text blocks with Mustache variables",
              "System component overrides plus custom templates",
              "Ticket-open prompt buttons and linked modal submit flows",
              "Staff command names — trigger templates with prefix + command in Discord",
              "Live preview panel with Discord Component V2 styling",
            ]}
            imageSrc="/settings-templates.png"
            imageAlt="imi/tickets template builder with block editor and live preview"
          />
        </div>

        <section className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              And a lot more under the hood
            </h2>
            <p className="text-muted-foreground">
              The screenshots above cover the staff UI. imi/tickets also includes
              bot commands, audit logging, linked-guild configuration, and
              Discord-native workflows your team already knows.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MORE_FEATURES.map((feature) => (
              <Card key={feature.title} size="sm">
                <CardHeader className="gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                    <feature.icon className="size-4" aria-hidden />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="hidden" />
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
