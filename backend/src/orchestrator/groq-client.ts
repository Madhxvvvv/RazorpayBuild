import OpenAI from "openai";

// Groq's API is OpenAI-compatible, so the same SDK works — just point it at
// Groq's base URL with a Groq key. orchestrator/llm-loop.ts and tools.ts stay
// provider-agnostic; they only depend on the OpenAI SDK's types, not on
// OpenAI's API actually being the backend.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export function createGroqClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
}
