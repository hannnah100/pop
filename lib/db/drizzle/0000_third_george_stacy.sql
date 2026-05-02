CREATE TABLE "three_strikes_challenges" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"total_count" integer NOT NULL,
	"answers" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crossword_puzzles" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"grid" text NOT NULL,
	"black_squares" text NOT NULL,
	"clues_across" text NOT NULL,
	"clues_down" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pop_question_prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt" text NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "roast_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"color" text,
	"category" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "pop_box_answer_counts" (
	"grid_id" text NOT NULL,
	"square_index" integer NOT NULL,
	"celebrity_id" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pop_box_answer_counts_grid_id_square_index_celebrity_id_pk" PRIMARY KEY("grid_id","square_index","celebrity_id")
);
--> statement-breakpoint
CREATE TABLE "pop_box_grids" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"difficulty" text NOT NULL,
	"row_category_ids" text NOT NULL,
	"column_category_ids" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pop_or_drop_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"player_token" text NOT NULL,
	"streak" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "pod_date_token_uidx" ON "pop_or_drop_scores" USING btree ("date","player_token");