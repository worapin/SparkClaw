CREATE TABLE "custom_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"language" varchar(10) NOT NULL,
	"code" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger_type" varchar(20) DEFAULT 'command' NOT NULL,
	"trigger_value" varchar(100),
	"timeout" integer DEFAULT 30 NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(20),
	"last_run_output" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "env_vars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"encrypted_value" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_skills" ADD CONSTRAINT "custom_skills_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_vars" ADD CONSTRAINT "env_vars_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_skills_instance_id_idx" ON "custom_skills" USING btree ("instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_skills_instance_name_idx" ON "custom_skills" USING btree ("instance_id","name");--> statement-breakpoint
CREATE INDEX "env_vars_instance_id_idx" ON "env_vars" USING btree ("instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "env_vars_instance_key_idx" ON "env_vars" USING btree ("instance_id","key");