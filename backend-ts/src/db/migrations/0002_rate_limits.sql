ALTER TABLE `provider_config` ADD COLUMN `openai_per_request_max` integer NOT NULL DEFAULT 150000;--> statement-breakpoint
ALTER TABLE `provider_config` ADD COLUMN `openai_tpm_limit` integer NOT NULL DEFAULT 180000;
