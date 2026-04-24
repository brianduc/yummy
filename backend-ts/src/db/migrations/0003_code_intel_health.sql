-- Add code-intel health fields to scan_status so the UI / RAG panel can
-- distinguish "RAG broken" from "scan failed". Nullable boolean: NULL =
-- scan never reached the code-intel phase.
ALTER TABLE `scan_status` ADD COLUMN `code_intel_ok` integer;--> statement-breakpoint
ALTER TABLE `scan_status` ADD COLUMN `code_intel_message` text NOT NULL DEFAULT '';
