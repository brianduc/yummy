CREATE TABLE `provider_config` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`provider` text DEFAULT 'gemini' NOT NULL,
	`gemini_key` text DEFAULT '' NOT NULL,
	`gemini_model` text DEFAULT '' NOT NULL,
	`ollama_base_url` text DEFAULT '' NOT NULL,
	`ollama_model` text DEFAULT '' NOT NULL,
	`copilot_token` text DEFAULT '' NOT NULL,
	`copilot_model` text DEFAULT '' NOT NULL,
	`openai_key` text DEFAULT '' NOT NULL,
	`openai_model` text DEFAULT '' NOT NULL,
	`bedrock_access_key` text DEFAULT '' NOT NULL,
	`bedrock_secret_key` text DEFAULT '' NOT NULL,
	`bedrock_region` text DEFAULT '' NOT NULL,
	`bedrock_model` text DEFAULT '' NOT NULL
);
