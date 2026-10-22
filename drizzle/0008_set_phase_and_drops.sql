ALTER TABLE "workout_sets" ADD COLUMN "phase" text DEFAULT 'work' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "drops" jsonb DEFAULT '[]'::jsonb NOT NULL;