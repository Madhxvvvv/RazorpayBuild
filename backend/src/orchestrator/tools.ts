import type OpenAI from "openai";

// Deliberately narrow and read-heavy — per section 3.6 of the architecture
// doc, there is NO tool here that spends money. propose_cart only proposes;
// the orchestrator intercepts it and routes it through the real Policy
// Engine before anything resembling a charge happens.
export const ORCHESTRATOR_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_catalog",
      description: "Search the product catalog by free-text query, optionally capped at a max price.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search, e.g. 'protein bar' or 'rice'." },
          maxPriceInPaise: {
            type: "number",
            description: "Optional upper price bound in paise (INR smallest unit, 100 paise = 1 rupee).",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_meta",
      description:
        "Get agent-specific metadata for one SKU: live stock, refund window, category tags, max quantity per order, and upsell-of relationships.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
        },
        required: ["sku"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_cart",
      description:
        "Propose a final cart of items to purchase. This ends your turn — the cart is checked against the user's spending policy before anything is charged. Call this once you've decided what to buy.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: { type: "string" },
                qty: { type: "number", minimum: 1 },
              },
              required: ["sku", "qty"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
];
