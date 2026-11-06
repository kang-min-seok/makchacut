CREATE TABLE "graph_snapshot" (
	"day_type" "day_type" PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"byte_size" integer NOT NULL,
	"stop_count" integer NOT NULL,
	"pattern_count" integer NOT NULL,
	"trip_count" integer NOT NULL,
	"built_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graph_snapshot" ENABLE ROW LEVEL SECURITY;