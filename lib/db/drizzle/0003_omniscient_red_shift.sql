CREATE TABLE "three_flops_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"player_token" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reel_connections_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"actors" text NOT NULL,
	"valid_answers" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reel_connections_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"player_token" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pop_box_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"player_token" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_poll_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_roast_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_scattergories_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skinny_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"puzzle_id" text NOT NULL,
	"player_token" text NOT NULL,
	"completion_time_secs" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_names" (
	"player_token" text PRIMARY KEY NOT NULL,
	"player_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clock_it_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"player_token" text NOT NULL,
	"score" integer NOT NULL,
	"hints_used" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"auth_provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tf_date_token_uidx" ON "three_flops_scores" USING btree ("date","player_token");--> statement-breakpoint
CREATE UNIQUE INDEX "rc_date_token_uidx" ON "reel_connections_scores" USING btree ("date","player_token");--> statement-breakpoint
CREATE UNIQUE INDEX "pb_date_token_uidx" ON "pop_box_scores" USING btree ("date","player_token");--> statement-breakpoint
CREATE UNIQUE INDEX "skinny_puzzle_token_uidx" ON "skinny_scores" USING btree ("puzzle_id","player_token");--> statement-breakpoint
CREATE UNIQUE INDEX "ci_date_token_uidx" ON "clock_it_scores" USING btree ("date","player_token");