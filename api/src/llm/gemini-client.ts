import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import { z, type ZodSchema } from "zod";
import { env } from "../config/env.js";

const MAX_RETRIES = 2;
const SELF_REPAIR_RETRIES = 1;

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    _client = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return _client;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmResponse<T> {
  data: T;
  usage: LlmUsage;
}

function buildConfig(overrides?: Partial<GenerationConfig>): GenerationConfig {
  return {
    temperature: env.llmTemperature,
    maxOutputTokens: env.llmMaxTokens,
    ...overrides,
  };
}

function extractUsage(response: unknown): LlmUsage {
  const meta = (response as { usageMetadata?: Record<string, number> })?.usageMetadata;
  return {
    promptTokens: meta?.promptTokenCount ?? 0,
    completionTokens: meta?.candidatesTokenCount ?? 0,
    totalTokens: meta?.totalTokenCount ?? 0,
  };
}

async function callWithRetry(
  prompt: string,
  config: GenerationConfig,
  retries = MAX_RETRIES,
): Promise<{ text: string; usage: LlmUsage }> {
  const model = getClient().getGenerativeModel({
    model: env.geminiModel,
    generationConfig: config,
  });

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      const usage = extractUsage(response);
      console.log(`[llm] tokens: prompt=${usage.promptTokens} completion=${usage.completionTokens}`);
      return { text, usage };
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;

      if (status === 429) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[llm] rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (attempt < retries) {
        console.warn(`[llm] error (attempt ${attempt + 1}/${retries + 1}):`, err);
        continue;
      }
    }
  }

  throw lastError;
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return raw.trim();
}

export async function generateText(
  prompt: string,
  configOverrides?: Partial<GenerationConfig>,
): Promise<LlmResponse<string>> {
  const config = buildConfig(configOverrides);
  const { text, usage } = await callWithRetry(prompt, config);
  return { data: text, usage };
}

export async function generateJson<T>(
  prompt: string,
  schema: ZodSchema<T>,
  configOverrides?: Partial<GenerationConfig>,
): Promise<LlmResponse<T>> {
  const config = buildConfig({
    temperature: 0.3,
    ...configOverrides,
  });

  const { text, usage } = await callWithRetry(prompt, config);
  const jsonStr = extractJson(text);

  const firstParse = schema.safeParse(JSON.parse(jsonStr));
  if (firstParse.success) {
    return { data: firstParse.data, usage };
  }

  console.warn("[llm] JSON validation failed, attempting self-repair");

  const repairPrompt = [
    "The previous response had validation errors. Fix the JSON to match the schema.",
    "",
    "Validation errors:",
    JSON.stringify(firstParse.error.flatten(), null, 2),
    "",
    "Original response:",
    jsonStr,
    "",
    "Return ONLY valid JSON, no markdown fences or explanations.",
  ].join("\n");

  const repair = await callWithRetry(repairPrompt, config, SELF_REPAIR_RETRIES);
  const repairJson = extractJson(repair.text);
  const secondParse = schema.safeParse(JSON.parse(repairJson));

  const totalUsage: LlmUsage = {
    promptTokens: usage.promptTokens + repair.usage.promptTokens,
    completionTokens: usage.completionTokens + repair.usage.completionTokens,
    totalTokens: usage.totalTokens + repair.usage.totalTokens,
  };

  if (secondParse.success) {
    return { data: secondParse.data, usage: totalUsage };
  }

  throw new Error(
    `LLM JSON self-repair failed: ${JSON.stringify(secondParse.error.flatten())}`,
  );
}
