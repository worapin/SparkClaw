CREATE TABLE "channel_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credentials" jsonb,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(20) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "setup_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "instance_name" varchar(100);--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "timezone" varchar(50) DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "ai_config" jsonb;--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "features" jsonb;--> statement-breakpoint
ALTER TABLE "channel_configs" ADD CONSTRAINT "channel_configs_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_configs_instance_id_idx" ON "channel_configs" USING btree ("instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_configs_instance_type_idx" ON "channel_configs" USING btree ("instance_id","type");--> statement-breakpoint
CREATE INDEX "instances_setup_completed_idx" ON "instances" USING btree ("setup_completed");