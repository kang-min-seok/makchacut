CREATE TYPE "public"."confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."day_type" AS ENUM('weekday', 'sat', 'sun', 'holiday');--> statement-breakpoint
CREATE TYPE "public"."ingest_source" AS ENUM('seoul_bus', 'gbis', 'gbis_web', 'seoul_subway', 'holiday');--> statement-breakpoint
CREATE TYPE "public"."last_time_source" AS ENUM('seoul_api', 'gbis_eta', 'distance');--> statement-breakpoint
CREATE TYPE "public"."route_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."stop_mode" AS ENUM('bus', 'subway');--> statement-breakpoint
CREATE TYPE "public"."train_direction" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."transit_source" AS ENUM('seoul_bus', 'gbis', 'seoul_subway');--> statement-breakpoint
CREATE TABLE "bus_schedule" (
	"route_id" integer NOT NULL,
	"day_type" "day_type" NOT NULL,
	"first_at_origin" real,
	"last_at_origin" real,
	"first_at_turn" real,
	"last_at_turn" real,
	"min_headway_minutes" smallint,
	"max_headway_minutes" smallint,
	CONSTRAINT "bus_schedule_route_id_day_type_pk" PRIMARY KEY("route_id","day_type")
);
--> statement-breakpoint
ALTER TABLE "bus_schedule" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bus_stop_last" (
	"route_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"day_type" "day_type" NOT NULL,
	"last_minutes" real NOT NULL,
	"source" "last_time_source" NOT NULL,
	"confidence" "confidence" NOT NULL,
	CONSTRAINT "bus_stop_last_route_id_seq_day_type_pk" PRIMARY KEY("route_id","seq","day_type")
);
--> statement-breakpoint
ALTER TABLE "bus_stop_last" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "footpath" (
	"from_stop_id" integer NOT NULL,
	"to_stop_id" integer NOT NULL,
	"walk_seconds" integer NOT NULL,
	CONSTRAINT "footpath_from_stop_id_to_stop_id_pk" PRIMARY KEY("from_stop_id","to_stop_id")
);
--> statement-breakpoint
ALTER TABLE "footpath" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "holiday" (
	"date" date PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "holiday" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ingest_target" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "ingest_source" NOT NULL,
	"target_id" text NOT NULL,
	"day_type" "day_type",
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "ingest_target_source_target_day_unique" UNIQUE NULLS NOT DISTINCT("source","target_id","day_type")
);
--> statement-breakpoint
ALTER TABLE "ingest_target" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "route" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "transit_source" NOT NULL,
	"source_route_id" text NOT NULL,
	"name" text NOT NULL,
	"route_type" text,
	"origin_stop_id" integer,
	"turn_stop_id" integer,
	CONSTRAINT "route_source_route_unique" UNIQUE("source","source_route_id")
);
--> statement-breakpoint
ALTER TABLE "route" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "route_stop" (
	"route_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"stop_id" integer NOT NULL,
	"direction" "route_direction" NOT NULL,
	"distance_from_origin_m" integer,
	CONSTRAINT "route_stop_route_id_seq_pk" PRIMARY KEY("route_id","seq")
);
--> statement-breakpoint
ALTER TABLE "route_stop" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stop" (
	"id" serial PRIMARY KEY NOT NULL,
	"mode" "stop_mode" NOT NULL,
	"name" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"stop_no" text
);
--> statement-breakpoint
ALTER TABLE "stop" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stop_source" (
	"source" "transit_source" NOT NULL,
	"source_stop_id" text NOT NULL,
	"stop_id" integer NOT NULL,
	"name" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"stop_no" text,
	CONSTRAINT "stop_source_source_source_stop_id_pk" PRIMARY KEY("source","source_stop_id")
);
--> statement-breakpoint
ALTER TABLE "stop_source" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "train_stop_time" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"stop_id" integer NOT NULL,
	"arrival_minutes" real,
	"departure_minutes" real
);
--> statement-breakpoint
ALTER TABLE "train_stop_time" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "train_trip" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_id" integer NOT NULL,
	"train_no" text NOT NULL,
	"day_type" "day_type" NOT NULL,
	"direction" "train_direction" NOT NULL,
	"destination_stop_id" integer,
	"destination_name" text,
	"is_express" boolean DEFAULT false NOT NULL,
	CONSTRAINT "train_trip_route_day_train_unique" UNIQUE("route_id","day_type","train_no")
);
--> statement-breakpoint
ALTER TABLE "train_trip" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingest_run" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bus_schedule" ADD CONSTRAINT "bus_schedule_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bus_stop_last" ADD CONSTRAINT "bus_stop_last_route_stop_fk" FOREIGN KEY ("route_id","seq") REFERENCES "public"."route_stop"("route_id","seq") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footpath" ADD CONSTRAINT "footpath_from_stop_id_stop_id_fk" FOREIGN KEY ("from_stop_id") REFERENCES "public"."stop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footpath" ADD CONSTRAINT "footpath_to_stop_id_stop_id_fk" FOREIGN KEY ("to_stop_id") REFERENCES "public"."stop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route" ADD CONSTRAINT "route_origin_stop_id_stop_id_fk" FOREIGN KEY ("origin_stop_id") REFERENCES "public"."stop"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route" ADD CONSTRAINT "route_turn_stop_id_stop_id_fk" FOREIGN KEY ("turn_stop_id") REFERENCES "public"."stop"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stop" ADD CONSTRAINT "route_stop_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stop" ADD CONSTRAINT "route_stop_stop_id_stop_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop_source" ADD CONSTRAINT "stop_source_stop_id_stop_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_stop_time" ADD CONSTRAINT "train_stop_time_trip_id_train_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."train_trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_stop_time" ADD CONSTRAINT "train_stop_time_stop_id_stop_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."stop"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_trip" ADD CONSTRAINT "train_trip_route_id_route_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "train_trip" ADD CONSTRAINT "train_trip_destination_stop_id_stop_id_fk" FOREIGN KEY ("destination_stop_id") REFERENCES "public"."stop"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_target_source_success_idx" ON "ingest_target" USING btree ("source","last_success_at");--> statement-breakpoint
CREATE INDEX "route_stop_stop_idx" ON "route_stop" USING btree ("stop_id");--> statement-breakpoint
CREATE INDEX "stop_source_stop_idx" ON "stop_source" USING btree ("stop_id");--> statement-breakpoint
CREATE INDEX "train_stop_time_trip_idx" ON "train_stop_time" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "train_stop_time_stop_idx" ON "train_stop_time" USING btree ("stop_id");