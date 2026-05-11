CREATE TABLE "read_the_room_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_code" text NOT NULL,
	"round" integer NOT NULL,
	"player_id" text NOT NULL,
	"answer" text NOT NULL,
	"revealed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "read_the_room_darts" (
	"room_code" text NOT NULL,
	"player_id" text NOT NULL,
	"round" integer NOT NULL,
	"target_answer" text NOT NULL,
	"target_player" text NOT NULL,
	"used" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "read_the_room_darts_room_code_player_id_pk" PRIMARY KEY("room_code","player_id")
);
--> statement-breakpoint
CREATE TABLE "read_the_room_rooms" (
	"room_code" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"game_state" text DEFAULT 'lobby' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "read_the_room_scores" (
	"room_code" text NOT NULL,
	"player_id" text NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "read_the_room_scores_room_code_player_id_pk" PRIMARY KEY("room_code","player_id")
);
