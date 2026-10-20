import { integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const ingestStatus = pgEnum('ingest_status', ['running', 'succeeded', 'failed']);

export const ingestRun = pgTable('ingest_run', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  status: ingestStatus('status').notNull().default('running'),
  rowCount: integer('row_count'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});
