CREATE TYPE "public"."ingest_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "ingest_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"status" "ingest_status" DEFAULT 'running' NOT NULL,
	"row_count" integer,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
