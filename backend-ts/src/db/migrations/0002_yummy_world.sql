-- world_config: singleton row (id=1), bearer token config
CREATE TABLE IF NOT EXISTS `world_config` (
  `id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
  `mcp_server_token` text DEFAULT '' NOT NULL,
  `mcp_server_enabled` integer DEFAULT false NOT NULL,
  `mcp_server_port` text DEFAULT '' NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `world_config` (`id`) VALUES (1);
--> statement-breakpoint
-- world_servers: MCP server connection configs
CREATE TABLE IF NOT EXISTS `world_servers` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `transport` text NOT NULL,
  `command` text,
  `args` text,
  `url` text,
  `headers_json` text,
  `enabled` integer DEFAULT true NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `last_status` text DEFAULT 'unknown' NOT NULL
);
--> statement-breakpoint
-- Add kind column to request_logs for MCP tracking
ALTER TABLE `request_logs` ADD `kind` text DEFAULT 'ai_call' NOT NULL;
