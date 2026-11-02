CREATE TABLE "seoul_stop_last" (
	"route_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"day_type" "day_type" NOT NULL,
	"last_minutes" real NOT NULL,
	"observed_on" date NOT NULL,
	CONSTRAINT "seoul_stop_last_route_id_seq_day_type_pk" PRIMARY KEY("route_id","seq","day_type")
);
--> statement-breakpoint
ALTER TABLE "seoul_stop_last" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingest_run" ADD COLUMN "api_calls" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "route_stop" ADD COLUMN "segment_seconds" integer;--> statement-breakpoint
ALTER TABLE "route_stop" ADD COLUMN "segment_meters" integer;--> statement-breakpoint
ALTER TABLE "seoul_stop_last" ADD CONSTRAINT "seoul_stop_last_route_stop_fk" FOREIGN KEY ("route_id","seq") REFERENCES "public"."route_stop"("route_id","seq") ON DELETE cascade ON UPDATE no action;