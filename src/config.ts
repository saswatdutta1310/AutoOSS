import dotenv from "dotenv";
import { z } from "zod";

export const ConfigSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  AUTOOSS_MODEL: z.string().default("gemini-2.5-flash"),
  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().optional().default(""),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(envPath?: string): Config {
  if (envPath) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config();
  }

  const raw = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || undefined,
    AUTOOSS_MODEL: process.env.AUTOOSS_MODEL || undefined,
    OLLAMA_URL: process.env.OLLAMA_URL || undefined,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || undefined,
  };

  return ConfigSchema.parse(raw);
}

export function redact(str: string | undefined | null): string {
  if (!str) {
    return "";
  }
  if (str.length <= 4) {
    return "*".repeat(str.length);
  }
  return "*".repeat(str.length - 4) + str.slice(-4);
}
