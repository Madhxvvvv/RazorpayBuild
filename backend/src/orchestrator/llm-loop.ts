import type OpenAI from "openai";
import { getAgentMeta, searchProducts } from "../catalog/catalog.service.js";
import { ORCHESTRATOR_TOOLS } from "./tools.js";
import type { ProposedCartItem } from "./types.js";

export type LlmLoopResult = { type: "text"; text: string } | { type: "propose_cart"; items: ProposedCartItem[] };

const SYSTEM_PROMPT = [
  "You are a shopping assistant for an agentic storefront.",
  "Use search_catalog and get_agent_meta to find suitable products for the user's request.",
  "You never charge money yourself. Once you've decided what to buy, call propose_cart with the exact",
  "skus and quantities — a separate policy system decides whether the purchase is actually allowed.",
  "If nothing in the catalog matches, say so plainly instead of proposing an empty or unrelated cart.",
].join(" ");

const MAX_TURNS = 6;

/** The only two tools the model can call without ending its turn — both read-only. */
async function executeReadTool(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): Promise<unknown> {
  if (toolCall.type !== "function") {
    return { error: "unsupported tool call type" };
  }

  const args = JSON.parse(toolCall.function.arguments || "{}");
  switch (toolCall.function.name) {
    case "search_catalog":
      return searchProducts(args.query, args.maxPriceInPaise);
    case "get_agent_meta":
      return getAgentMeta(args.sku);
    default:
      return { error: `unknown tool ${toolCall.function.name}` };
  }
}

export async function runOrchestratorLoop(
  client: OpenAI,
  model: string,
  userMessage: string,
): Promise<LlmLoopResult> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.chat.completions.create({ model, messages, tools: ORCHESTRATOR_TOOLS });
    const message = response.choices[0]?.message;
    if (!message) {
      return { type: "text", text: "Something went wrong talking to the assistant." };
    }
    messages.push(message);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { type: "text", text: message.content ?? "" };
    }

    const proposeCartCall = toolCalls.find((tc) => tc.type === "function" && tc.function.name === "propose_cart");
    if (proposeCartCall && proposeCartCall.type === "function") {
      const args = JSON.parse(proposeCartCall.function.arguments || "{}") as { items: ProposedCartItem[] };
      return { type: "propose_cart", items: args.items ?? [] };
    }

    for (const toolCall of toolCalls) {
      const result = await executeReadTool(toolCall);
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  return { type: "text", text: "I couldn't settle on a suitable item in time — could you rephrase your request?" };
}
