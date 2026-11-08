import { GoogleGenAI, type GenerateContentConfig, type Schema } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export function getTextModel() {
  return process.env.GEMINI_MODEL || "gemini-3.5-flash";
}

/** Faster, lighter model tried when the main one errors (e.g. 503 "high demand"). */
function getFallbackModel() {
  return process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
}

/** Optional reasoning effort for text calls ("LOW" keeps latency down on thinking models). */
function thinkingConfig(): GenerateContentConfig["thinkingConfig"] {
  const level = process.env.GEMINI_THINKING_LEVEL;
  return level ? ({ thinkingLevel: level } as GenerateContentConfig["thinkingConfig"]) : undefined;
}

const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 45_000;

type JsonRequest = {
  system: string;
  user: string;
  schema: Schema;
  temperature?: number;
};

/** Asks Gemini for JSON matching `schema` and parses it, falling back to a lighter model. */
export async function generateJson<T>(params: JsonRequest): Promise<T> {
  try {
    return await generateJsonWith<T>(getTextModel(), params);
  } catch (err) {
    const fallback = getFallbackModel();
    if (fallback === getTextModel()) throw err;
    console.warn(`[gemini] ${getTextModel()} failed, trying ${fallback}: ${errorMessage(err)}`);
    return generateJsonWith<T>(fallback, params);
  }
}

async function generateJsonWith<T>(model: string, params: JsonRequest): Promise<T> {
  const response = await getGemini().models.generateContent({
    model,
    contents: params.user,
    config: {
      systemInstruction: params.system,
      temperature: params.temperature ?? 0.3,
      responseMimeType: "application/json",
      responseSchema: params.schema,
      thinkingConfig: thinkingConfig(),
      httpOptions: { timeout: REQUEST_TIMEOUT_MS },
    },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text) as T;
}

/** Runs at most `max` tasks at once; the rest wait their turn (keeps us under rate limits). */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

/** Shared limiter for every Gemini call the server makes. */
export const geminiLimit = createLimiter(Number(process.env.GEMINI_CONCURRENCY) || 6);

/** Retries a flaky call with exponential backoff and a little jitter. */
export async function withRetry<T>(
  task: () => Promise<T>,
  { attempts = 3, baseDelayMs = 800, label = "task" } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (attempt === attempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 250;
      console.warn(`[gemini] ${label} failed (attempt ${attempt}/${attempts}): ${errorMessage(err)}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message.slice(0, 300) : String(err);
}
