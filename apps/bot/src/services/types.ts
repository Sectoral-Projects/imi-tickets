import type { container } from '@sapphire/framework';

/**
 * Derived directly from `container.sqlite` rather than reconstructed from
 * `BetterSQLite3Database<typeof schema>` — that way this type can never
 * drift out of sync with however `container.sqlite` is actually declared
 * in your Sapphire container augmentation.
 */
export type Database = typeof container.sqlite;

/**
 * Extracts the transaction type from `db.transaction((tx) => ...)`.
 * `tx` supports the same query-builder API as `Database`, so services
 * can accept either one interchangeably.
 */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Every service method takes a `db: DbClient` param defaulting to
 * `container.sqlite`. Pass a `tx` instead to fold the call into an
 * existing transaction (see TicketService.create / MessageService.create
 * for examples of composing multiple writes atomically).
 *
 * IMPORTANT: better-sqlite3 transactions are synchronous. Inside a
 * `db.transaction((tx) => { ... })` callback, never use `async`/`await` —
 * always finish query builders with `.run()` / `.get()` / `.all()`.
 */
export type DbClient = Database | Transaction;