import { GoogleGenAI } from "@google/genai";

export function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

export function getChatModel() {
  return process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";
}

export async function generateText(params: {
  system: string;
  user: string;
  temperature?: number;
}) {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: getChatModel(),
    contents: params.user,
    config: {
      systemInstruction: params.system,
      temperature: params.temperature ?? 0.4,
    },
  });
  return (response.text || "").trim();
}

export async function generateJson(params: {
  system: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  temperature?: number;
}) {
  const ai = getGemini();

  const contents = params.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const response = await ai.models.generateContent({
    model: getChatModel(),
    contents,
    config: {
      systemInstruction: params.system,
      temperature: params.temperature ?? 0.3,
      responseMimeType: "application/json",
    },
  });

  return (response.text || "{}").trim();
}
