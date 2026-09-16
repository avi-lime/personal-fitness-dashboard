ALTER TABLE "mcp_audit_log" ADD COLUMN "channel" text DEFAULT 'mcp' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;