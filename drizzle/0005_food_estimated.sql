ALTER TABLE "food_logs" ADD COLUMN "estimated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "estimated" boolean DEFAULT false NOT NULL;