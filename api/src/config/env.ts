import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

export const env = {
  port: Number(process.env.PORT) || 4000,
  saKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "../sa.json",

  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  llmMaxTokens: Number(process.env.LLM_MAX_TOKENS) || 8192,
  llmTemperature: Number(process.env.LLM_TEMPERATURE) || 1.0,
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 30_000,
} as const;
