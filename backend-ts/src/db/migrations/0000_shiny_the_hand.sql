CREATE TABLE "kb_insights" (
	"id" bigint PRIMARY KEY NOT NULL,
	"files" jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_meta" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"project_summary" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_tree" (
	"path" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"provider" text DEFAULT 'gemini' NOT NULL,
	"gemini_key" text DEFAULT '' NOT NULL,
	"gemini_model" text DEFAULT '' NOT NULL,
	"ollama_base_url" text DEFAULT '' NOT NULL,
	"ollama_model" text DEFAULT '' NOT NULL,
	"copilot_token" text DEFAULT '' NOT NULL,
	"copilot_model" text DEFAULT '' NOT NULL,
	"openai_key" text DEFAULT '' NOT NULL,
	"openai_model" text DEFAULT '' NOT NULL,
	"openai_base_url" text DEFAULT '' NOT NULL,
	"bedrock_access_key" text DEFAULT '' NOT NULL,
	"bedrock_secret_key" text DEFAULT '' NOT NULL,
	"bedrock_region" text DEFAULT '' NOT NULL,
	"bedrock_model" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_info" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"branch" text,
	"url" text NOT NULL,
	"github_token" text DEFAULT '' NOT NULL,
	"max_scan_limit" integer DEFAULT 10000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_logs" (
	"id" bigint PRIMARY KEY NOT NULL,
	"time" text NOT NULL,
	"agent" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"in_tokens" integer NOT NULL,
	"out_tokens" integer NOT NULL,
	"latency" double precision NOT NULL,
	"cost" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_status" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"running" boolean DEFAULT false NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"error" boolean DEFAULT false NOT NULL,
	"initialized" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chat_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agent_outputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"jira_backlog" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metrics" jsonb DEFAULT '{"tokens":0}'::jsonb NOT NULL,
	"workflow_state" text DEFAULT 'idle' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"mcp_server_token" text DEFAULT '' NOT NULL,
	"mcp_server_enabled" boolean DEFAULT false NOT NULL,
	"mcp_server_port" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"transport" text NOT NULL,
	"command" text,
	"args" jsonb,
	"url" text,
	"headers_json" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_status" text DEFAULT 'unknown' NOT NULL
);
