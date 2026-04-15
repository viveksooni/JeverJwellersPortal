CREATE TABLE "day_remarks" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"remark" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_remarks_date_unique" UNIQUE("date")
);
