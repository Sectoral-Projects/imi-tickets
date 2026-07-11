export type StaffActionFilter = "all" | "messages" | "closes" | "notes";

export type StaffMemberSummary = {
  userId: string;
  displayName: string;
  username: string | null;
  globalName: string | null;
  avatar: string | null;
  ticketsHandled: number;
  messagesSent: number;
  ticketsClosed: number;
  ticketsReopened: number;
  notesCreated: number;
  lastActiveAt: string | null;
};

export type StaffActivityPoint = {
  date: string;
  messages: number;
  actions: number;
};

export type StaffStatsTopMember = {
  userId: string;
  displayName: string;
  avatar: string | null;
  ticketsHandled: number;
};

export type StaffStats = {
  totalTickets: number;
  ticketsInProgress: number;
  topStaff: StaffStatsTopMember[];
};

export type StaffAnalyticsResponse = {
  staff: StaffMemberSummary[];
  timeline: StaffActivityPoint[];
  stats: StaffStats;
};
