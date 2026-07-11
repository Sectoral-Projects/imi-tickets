import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Ticket, Timer, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuthGate, useProductAccessRedirect } from "@/lib/use-auth-gate";
import { useStaffAnalytics } from "../hooks/staff";
import type { StaffActionFilter, StaffMemberSummary, StaffStatsTopMember } from "../schemas/staff";
import {
  applyStaffFilters,
  formatRangeLabel,
  parseStaffFilters,
  type StaffDateRange,
} from "../utils/staff-filters";
import { StaffDateRangePicker } from "./staff-date-range-picker";
import {
  StaffChartSkeleton,
  StaffMemberCardsSkeleton,
  StaffPageSkeleton,
} from "./staff-page-skeleton";

const chartConfig = {
  messages: {
    label: "Messages",
    color: "var(--chart-1)",
  },
  actions: {
    label: "Actions",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function MetricBlock({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number;
  icon: typeof Ticket;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-22 flex-col justify-between rounded-lg border bg-muted/20 px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <div className="rounded-md bg-background/80 p-1.5 text-muted-foreground ring-1 ring-border/60">
          <Icon className="size-3.5 shrink-0" aria-hidden />
        </div>
      </div>
      <p className="text-3xl font-semibold tabular-nums leading-none tracking-tight">
        {loading ? "—" : value.toLocaleString()}
      </p>
    </div>
  );
}

function StaffOverviewPanel({
  totalTickets,
  ticketsInProgress,
  topStaff,
  range,
  loading,
  selectedStaffId,
  onSelect,
}: {
  totalTickets: number;
  ticketsInProgress: number;
  topStaff: StaffStatsTopMember[];
  range: StaffDateRange;
  loading?: boolean;
  selectedStaffId: string | null;
  onSelect: (userId: string | null) => void;
}) {
  const podiumSlots = [0, 1, 2].map((index) => topStaff[index] ?? null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Overview</CardTitle>
          <span className="text-xs text-muted-foreground">{formatRangeLabel(range)}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] lg:items-stretch lg:gap-5">
          <MetricBlock
            title="Total tickets"
            value={totalTickets}
            icon={Ticket}
            loading={loading}
          />
          <MetricBlock
            title="In progress"
            value={ticketsInProgress}
            icon={Timer}
            loading={loading}
          />

          <div className="flex min-h-22 flex-col rounded-lg border bg-muted/10 px-3 py-3 md:col-span-2 lg:col-span-1">
            <div className="mb-2.5 flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="size-3.5" aria-hidden />
              <span className="text-xs font-medium">Top staff by tickets handled</span>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                {podiumSlots.map((member, index) => {
                  if (!member) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="flex min-h-13 items-center justify-center gap-2 rounded-md border border-dashed border-border/80 px-2 text-xs text-muted-foreground"
                      >
                        <span className="font-medium">#{index + 1}</span>
                        <span>—</span>
                      </div>
                    );
                  }

                  const avatarUrl = member.avatar
                    ? `https://cdn.discordapp.com/avatars/${member.userId}/${member.avatar}.png`
                    : undefined;
                  const selected = selectedStaffId === member.userId;
                  const isFirst = index === 0;

                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => onSelect(selected ? null : member.userId)}
                      className={cn(
                        "flex min-h-13 min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                        isFirst && !selected && "border-primary/20 bg-muted/30",
                        selected && "border-primary bg-muted/40 ring-1 ring-primary/30",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-medium text-muted-foreground",
                          isFirst && "text-primary",
                        )}
                      >
                        #{index + 1}
                      </span>
                      <Avatar className="size-7 shrink-0">
                        <AvatarImage src={avatarUrl} alt={member.displayName} />
                        <AvatarFallback className="text-[10px]">
                          {member.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">
                        {member.displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StaffMemberCard({
  member,
  selected,
  onSelect,
}: {
  member: StaffMemberSummary;
  selected: boolean;
  onSelect: (userId: string | null) => void;
}) {
  const avatarUrl = member.avatar
    ? `https://cdn.discordapp.com/avatars/${member.userId}/${member.avatar}.png`
    : undefined;

  return (
    <Card
      className={selected ? "ring-2 ring-primary" : undefined}
      onClick={() => onSelect(selected ? null : member.userId)}
    >
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={avatarUrl} alt={member.displayName} />
          <AvatarFallback>
            {member.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-base">{member.displayName}</CardTitle>
          <CardDescription className="truncate">{member.userId}</CardDescription>
        </div>
        {member.lastActiveAt && (
          <Badge variant="secondary" className="shrink-0">
            {new Date(member.lastActiveAt).toLocaleDateString()}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Tickets</p>
          <p className="font-medium">{member.ticketsHandled}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Messages</p>
          <p className="font-medium">{member.messagesSent}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Closed</p>
          <p className="font-medium">{member.ticketsClosed}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Reopened</p>
          <p className="font-medium">{member.ticketsReopened}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Notes</p>
          <p className="font-medium">{member.notesCreated}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StaffContent() {
  const session = useAuthGate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseStaffFilters(searchParams), [searchParams]);
  const { action, range, staffUserId: selectedStaffId, search } = filters;
  const debouncedSearch = useDebouncedValue(search, 300);

  const updateFilters = useCallback(
    (patch: Parameters<typeof applyStaffFilters>[1]) => {
      setSearchParams((current) => applyStaffFilters(current, patch), { replace: true });
    },
    [setSearchParams],
  );

  const setSelectedStaffId = useCallback(
    (staffUserId: string | null) => {
      updateFilters({ staffUserId });
    },
    [updateFilters],
  );

  const { data, isLoading, isFetching, error } = useStaffAnalytics({
    search: debouncedSearch,
    action,
    range,
    staffUserId: selectedStaffId,
  });

  useProductAccessRedirect(error);

  const isInitialLoad = isLoading && !data;

  const chartData = useMemo(
    () =>
      (data?.timeline ?? []).map((point) => ({
        ...point,
        label: new Date(`${point.date}T12:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      })),
    [data?.timeline],
  );

  if (session.isPending || !session.data) {
    return <StaffPageSkeleton />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 md:p-6 [&>*]:shrink-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Staff analytics</h1>
        <p className="text-sm text-muted-foreground">
          Activity from staff who handled tickets — messages in ticket channels,
          closes, reopens, and notes.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input
          value={search}
          onChange={(event) => updateFilters({ search: event.target.value })}
          placeholder="Search staff by name or user ID..."
          className="sm:max-w-xs"
        />
        <Select
          value={action}
          onValueChange={(value) => updateFilters({ action: value as StaffActionFilter })}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Activity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            <SelectItem value="messages">Messages only</SelectItem>
            <SelectItem value="closes">Closes & reopens</SelectItem>
            <SelectItem value="notes">Notes only</SelectItem>
          </SelectContent>
        </Select>
        <StaffDateRangePicker
          range={range}
          onRangeChange={(nextRange) => updateFilters({ range: nextRange })}
        />
        {selectedStaffId && (
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => setSelectedStaffId(null)}
          >
            Clear staff filter
          </button>
        )}
      </div>

      <div className={cn(isFetching && !isInitialLoad && "opacity-80")}>
        <StaffOverviewPanel
          totalTickets={data?.stats.totalTickets ?? 0}
          ticketsInProgress={data?.stats.ticketsInProgress ?? 0}
          topStaff={data?.stats.topStaff ?? []}
          range={range}
          loading={isInitialLoad}
          selectedStaffId={selectedStaffId}
          onSelect={setSelectedStaffId}
        />
      </div>

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Activity timeline</CardTitle>
          <CardDescription>
            Daily staff touches across tickets
            {selectedStaffId ? " for the selected member" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isInitialLoad ? (
            <StaffChartSkeleton />
          ) : chartData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
              No activity in this range.
            </div>
          ) : (
            <div className="relative h-[280px] w-full">
              <ChartContainer
                config={chartConfig}
                className="aspect-auto !block h-[280px] w-full [&_.recharts-responsive-container]:size-full"
                initialDimension={{ width: 800, height: 280 }}
              >
                <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    type="monotone"
                    dataKey="actions"
                    stroke="var(--color-actions)"
                    fill="var(--color-actions)"
                    fillOpacity={0.45}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    stroke="var(--color-messages)"
                    fill="var(--color-messages)"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ChartContainer>

              {isFetching && !isInitialLoad && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <span className="text-sm text-muted-foreground">Updating chart...</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isInitialLoad ? (
        <StaffMemberCardsSkeleton />
      ) : error ? (
        <div className="text-sm text-muted-foreground">Error: {error.message}</div>
      ) : !data || data.staff.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No staff activity found for these filters.
          </CardContent>
        </Card>
      ) : (
        <div className={cn("relative", isFetching && "opacity-80")}>
          <div className="grid gap-4 md:grid-cols-2">
            {data.staff.map((member) => (
              <StaffMemberCard
                key={member.userId}
                member={member}
                selected={selectedStaffId === member.userId}
                onSelect={setSelectedStaffId}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Tip: click a staff card to filter the chart.
      </p>
    </div>
  );
}
