CREATE TABLE "rpg_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"period" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rpg_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cost" integer NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"program" text DEFAULT 'ppl' NOT NULL,
	"equipment" text DEFAULT 'gym' NOT NULL,
	"days_per_week" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "exercise_key" text;--> statement-breakpoint
ALTER TABLE "workout_template_exercises" ADD COLUMN "exercise_key" text;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "program_day" text;--> statement-breakpoint
ALTER TABLE "rpg_ledger" ADD CONSTRAINT "rpg_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rpg_rewards" ADD CONSTRAINT "rpg_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_settings" ADD CONSTRAINT "training_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rpg_ledger_user_idx" ON "rpg_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rpg_ledger_mission_once_idx" ON "rpg_ledger" USING btree ("user_id","key","period") WHERE "rpg_ledger"."kind" = 'mission';--> statement-breakpoint
CREATE INDEX "rpg_rewards_user_idx" ON "rpg_rewards" USING btree ("user_id","active");