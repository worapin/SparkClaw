ALTER TABLE "instances" DROP CONSTRAINT "instances_subscription_id_unique";--> statement-breakpoint
DROP INDEX "instances_subscription_id_idx";--> statement-breakpoint
CREATE INDEX "instances_subscription_id_idx" ON "instances" USING btree ("subscription_id");