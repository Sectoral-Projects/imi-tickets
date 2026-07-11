import { Link } from "react-router";
import { ArrowRight, GitBranch, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const FLOW_STEPS = [
  {
    title: "Members DM the bot",
    description:
      "A community member starts or continues a private conversation in Discord direct messages. imi/tickets creates or reuses a ticket thread behind the scenes.",
  },
  {
    title: "Staff work in Discord",
    description:
      "Replies can happen from ticket channels or forum posts. Messages, attachments, and identity context are stored as the source of truth.",
  },
  {
    title: "Your team stays in control",
    description:
      "RBAC decides who can read tickets or manage settings from the web UI. Settings, templates, analytics, and audit history give staff the tooling to run support at scale.",
  },
] as const;

const PILLARS = [
  {
    icon: MessageCircle,
    title: "Private by default",
    description:
      "Member DMs are not scattered across individual staff accounts. Conversations are centralized into tickets with preserved history.",
  },
  {
    icon: ShieldCheck,
    title: "Staff access you define",
    description:
      "Discord OAuth gets people in the door. Custom, server-aware role permissions decide what each staff member can see and change.",
  },
  {
    icon: GitBranch,
    title: "Self-hosted and auditable",
    description:
      "Run the bot and API together, keep data in SQLite, and extend templates or settings without handing control to a third-party inbox.",
  },
] as const;

export function AboutContent() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col gap-4">
          <Badge variant="secondary" className="w-fit">
            About
          </Badge>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            What is imi/tickets?
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            imi/tickets is a Discord modmail system with a staff web interface.
            It lets communities offer private support through DMs while giving
            moderators a durable ticket history, configurable bot messages, and
            analytics — all backed by one Node.js process running the Sapphire
            bot and Hono API.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} size="sm">
              <CardHeader className="gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                  <pillar.icon className="size-4" aria-hidden />
                </div>
                <CardTitle className="text-base">{pillar.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {pillar.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="hidden" />
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              How it works
            </h2>
            <p className="text-muted-foreground">
              The product spans a Discord bot and a Vite React staff app. The
              backend owns Discord side effects, persistence, auth, and API
              behavior; the UI is a client of that API.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {FLOW_STEPS.map((step, index) => (
              <Card key={step.title}>
                <CardHeader className="gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </div>
                  <CardDescription className="text-sm leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Built for teams who run their own community
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              Whether you route tickets into category channels or forum posts,
              imi/tickets keeps the same ticket model: threads, participants,
              messages, notes, tags, attachments, templates, and audit history.
              First-time hosts get a guided onboarding flow after Discord sign-in
              to link servers, invite the bot, choose routing, and configure
              staff permissions.
            </p>
            <p>
              On the web, staff get a searchable ticket inbox, a virtualized
              transcript view, analytics, and a settings area for privacy,
              automation, and Component V2 templates. On Discord, staff commands
              cover contact, logs, close, block, and more — all sharing the same
              services as the API.
            </p>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-xl font-semibold">
              Want the full tour?
            </h2>
            <p className="text-sm text-muted-foreground">
              See screenshots and a breakdown of every major feature in the app.
            </p>
          </div>
          <Button render={<Link to="/features" />}>
            Explore features
            <ArrowRight data-icon="inline-end" />
          </Button>
        </section>
      </div>
    </div>
  );
}
