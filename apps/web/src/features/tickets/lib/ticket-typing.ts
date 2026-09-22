import { useEffect, useSyncExternalStore } from "react";

export type TicketTyper = {
  userId: string;
  username: string | null;
  globalName: string | null;
  avatar: string | null;
  expiresAt: number;
};

const TYPING_TTL_MS = 8000;
const EMPTY_TYPERS: TicketTyper[] = [];

const typersByTicket = new Map<number, Map<string, TicketTyper>>();
const expiryTimers = new Map<string, number>();
const snapshotCache = new Map<number, { version: number; typers: TicketTyper[] }>();
const listeners = new Set<() => void>();
let storeVersion = 0;
let pruneTimer: number | null = null;

function typerKey(ticketId: number, userId: string) {
  return `${ticketId}:${userId}`;
}

function emit() {
  storeVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

function clearTyperTimer(ticketId: number, userId: string) {
  const key = typerKey(ticketId, userId);
  const timeoutId = expiryTimers.get(key);
  if (timeoutId === undefined) return;
  window.clearTimeout(timeoutId);
  expiryTimers.delete(key);
}

function removeTyper(ticketId: number, userId: string) {
  const typers = typersByTicket.get(ticketId);
  if (!typers) return false;

  const removed = typers.delete(userId);
  clearTyperTimer(ticketId, userId);
  if (typers.size === 0) {
    typersByTicket.delete(ticketId);
  }
  return removed;
}

function scheduleTyperExpiry(ticketId: number, userId: string, expiresAt: number) {
  clearTyperTimer(ticketId, userId);
  const timeoutId = window.setTimeout(() => {
    expiryTimers.delete(typerKey(ticketId, userId));
    const typers = typersByTicket.get(ticketId);
    const typer = typers?.get(userId);
    if (!typer || typer.expiresAt > Date.now()) return;
    if (removeTyper(ticketId, userId)) emit();
  }, Math.max(0, expiresAt - Date.now()));
  expiryTimers.set(typerKey(ticketId, userId), timeoutId);
}

function pruneExpiredTypers() {
  const now = Date.now();
  let changed = false;

  for (const [ticketId, typers] of typersByTicket) {
    for (const [userId, typer] of [...typers]) {
      if (typer.expiresAt <= now && removeTyper(ticketId, userId)) {
        changed = true;
      }
    }
  }

  if (changed) emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (pruneTimer === null) {
    pruneTimer = window.setInterval(() => pruneExpiredTypers(), 1000);
  }
}

function unsubscribe(listener: () => void) {
  listeners.delete(listener);
  if (listeners.size === 0 && pruneTimer !== null) {
    window.clearInterval(pruneTimer);
    pruneTimer = null;
  }
}

function subscribeTyping(onStoreChange: () => void) {
  subscribe(onStoreChange);
  return () => unsubscribe(onStoreChange);
}

function getStoreVersion() {
  return storeVersion;
}

export function applyTypingStart(event: {
  ticketId: number;
  userId: string;
  username?: string | null;
  globalName?: string | null;
  avatar?: string | null;
}) {
  const ticketId = Number(event.ticketId);
  if (!Number.isFinite(ticketId)) return;

  let typers = typersByTicket.get(ticketId);
  if (!typers) {
    typers = new Map();
    typersByTicket.set(ticketId, typers);
  }

  const expiresAt = Date.now() + TYPING_TTL_MS;
  typers.set(event.userId, {
    userId: event.userId,
    username: event.username ?? null,
    globalName: event.globalName ?? null,
    avatar: event.avatar ?? null,
    expiresAt,
  });
  scheduleTyperExpiry(ticketId, event.userId, expiresAt);
  emit();
}

export function clearTicketTypers(ticketId: number, userId?: string) {
  const typers = typersByTicket.get(ticketId);
  if (!typers) return;

  if (userId) {
    if (!removeTyper(ticketId, userId)) return;
  } else {
    for (const existingUserId of typers.keys()) {
      clearTyperTimer(ticketId, existingUserId);
    }
    typers.clear();
    typersByTicket.delete(ticketId);
  }

  emit();
}

export function getTicketTypers(ticketId: number): TicketTyper[] {
  const cached = snapshotCache.get(ticketId);
  if (cached && cached.version === storeVersion) return cached.typers;

  const typers = typersByTicket.get(ticketId);
  const now = Date.now();
  const next =
    typers === undefined
      ? EMPTY_TYPERS
      : [...typers.values()].filter((typer) => typer.expiresAt > now);
  const snapshot = next.length === 0 ? EMPTY_TYPERS : next;
  snapshotCache.set(ticketId, { version: storeVersion, typers: snapshot });
  return snapshot;
}

export function useTypingStoreVersion() {
  return useSyncExternalStore(subscribeTyping, getStoreVersion, getStoreVersion);
}

export function useTicketTyping(ticketId: number): TicketTyper[] {
  const version = useTypingStoreVersion();
  const typers = getTicketTypers(ticketId);

  useEffect(() => {
    const nextExpiry = typers.reduce(
      (soonest, typer) => Math.min(soonest, typer.expiresAt),
      Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(nextExpiry)) return;
    const timeoutId = window.setTimeout(() => {
      pruneExpiredTypers();
    }, Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timeoutId);
  }, [ticketId, typers, version]);

  return typers;
}
