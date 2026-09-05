import { beforeEach, describe, expect, it, vi } from "vitest";

const getConsentMock = vi.fn();
const appendMandateMock = vi.fn();
const getChainMock = vi.fn();
const getDayTotalInPaiseMock = vi.fn();
const recordOrderMock = vi.fn();
const isEngagedMock = vi.fn();
const productFindMock = vi.fn();
const findInStockAlternativeMock = vi.fn();

vi.mock("../../src/consent/consent.service.js", () => ({ getConsent: getConsentMock }));
vi.mock("../../src/ledger/ledger.service.js", () => ({
  appendMandate: appendMandateMock,
  getChain: getChainMock,
}));
vi.mock("../../src/orders/orders.service.js", () => ({
  getDayTotalInPaise: getDayTotalInPaiseMock,
  recordOrder: recordOrderMock,
}));
vi.mock("../../src/policy/kill-switch.js", () => ({ isEngaged: isEngagedMock }));
vi.mock("../../src/db/models/Product.js", () => ({ Product: { find: productFindMock } }));
vi.mock("../../src/catalog/catalog.service.js", () => ({ findInStockAlternative: findInStockAlternativeMock }));

const { createOrchestrator } = await import("../../src/orchestrator/orchestrator.js");

const CONSENT = {
  userId: "user-1",
  merchantId: "merchant-1",
  spendCapPerTxn: 50000,
  spendCapPerDay: 200000,
  categoryAllowlist: ["food"],
  expiresAt: new Date("2099-01-01"),
  revoked: false,
};

function makeRazorpayAdapter() {
  return {
    createOrder: vi.fn().mockResolvedValue({ id: "order_1", amountInPaise: 9900, currency: "INR", receipt: "r", status: "created" }),
    capturePayment: vi.fn(),
    createPaymentLink: vi.fn().mockResolvedValue({ id: "plink_1", shortUrl: "https://rzp.io/i/x", amountInPaise: 9900, currency: "INR", status: "created" }),
    refund: vi.fn(),
  };
}

function makeProductQuery(products: Array<{ sku: string; category: string; priceInPaise: number; maxQtyPerOrder: number; stock: number }>) {
  return { lean: vi.fn().mockResolvedValue(products) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDayTotalInPaiseMock.mockResolvedValue(0);
  isEngagedMock.mockReturnValue(false);
  getConsentMock.mockResolvedValue(CONSENT);
});

describe("orchestrator.handleMessage", () => {
  it("denies immediately when there's no consent on file", async () => {
    getConsentMock.mockResolvedValue(null);
    const orchestrator = createOrchestrator({ runLlmLoop: vi.fn(), razorpayAdapter: makeRazorpayAdapter() });

    const result = await orchestrator.handleMessage({ userId: "user-1", merchantId: "merchant-1", message: "hi" });

    expect(result).toEqual({ chainId: expect.any(String), type: "denied", reason: "no consent on file for this merchant" });
  });

  it("returns a plain reply when the model doesn't propose a cart", async () => {
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "text", text: "What are you in the mood for?" });
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter: makeRazorpayAdapter() });

    const result = await orchestrator.handleMessage({ userId: "user-1", merchantId: "merchant-1", message: "hi" });

    expect(result).toEqual({ chainId: expect.any(String), type: "reply", text: "What are you in the mood for?" });
    expect(appendMandateMock).toHaveBeenCalledWith(expect.any(String), "INTENT", { rawAsk: "hi" });
  });

  it("executes an allowed cart: writes CART/PAYMENT/EXECUTION and calls the Razorpay adapter", async () => {
    productFindMock.mockReturnValue(
      makeProductQuery([{ sku: "FOOD-PBAR-001", category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 5 }]),
    );
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "propose_cart", items: [{ sku: "FOOD-PBAR-001", qty: 1 }] });
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter });

    const result = await orchestrator.handleMessage({ userId: "user-1", merchantId: "merchant-1", message: "get me a protein bar" });

    expect(result).toEqual({
      type: "executed",
      chainId: expect.any(String),
      razorpayOrderId: "order_1",
      paymentLinkUrl: "https://rzp.io/i/x",
      amountInPaise: 9900,
    });
    expect(razorpayAdapter.createOrder).toHaveBeenCalledWith(9900, "INR", expect.any(String));
    expect(razorpayAdapter.createPaymentLink).toHaveBeenCalledWith(9900, expect.any(String));

    const mandateTypes = appendMandateMock.mock.calls.map((call) => call[1]);
    expect(mandateTypes).toEqual(["INTENT", "CART", "PAYMENT", "EXECUTION"]);
    expect(recordOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ razorpayOrderId: "order_1", status: "created", amountInPaise: 9900 }),
    );
  });

  it("denies a cart outside the category allowlist without calling Razorpay", async () => {
    productFindMock.mockReturnValue(
      makeProductQuery([{ sku: "ELEC-CABLE-001", category: "electronics", priceInPaise: 34900, maxQtyPerOrder: 5, stock: 10 }]),
    );
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "propose_cart", items: [{ sku: "ELEC-CABLE-001", qty: 1 }] });
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter });

    const result = await orchestrator.handleMessage({ userId: "user-1", merchantId: "merchant-1", message: "get me a cable" });

    expect(result).toEqual({ type: "denied", chainId: expect.any(String), reason: "category not allow-listed" });
    expect(razorpayAdapter.createOrder).not.toHaveBeenCalled();
    const mandateTypes = appendMandateMock.mock.calls.map((call) => call[1]);
    expect(mandateTypes).toEqual(["INTENT", "CART", "EXECUTION"]);
  });

  it("requires step-up for a cart over the per-transaction cap, without touching Razorpay", async () => {
    productFindMock.mockReturnValue(
      makeProductQuery([{ sku: "FOOD-PBAR-001", category: "food", priceInPaise: 60000, maxQtyPerOrder: 10, stock: 5 }]),
    );
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "propose_cart", items: [{ sku: "FOOD-PBAR-001", qty: 1 }] });
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter });

    const result = await orchestrator.handleMessage({ userId: "user-1", merchantId: "merchant-1", message: "get me an expensive bar" });

    expect(result).toMatchObject({ type: "step_up", totalInPaise: 60000 });
    expect(razorpayAdapter.createOrder).not.toHaveBeenCalled();
  });

  it("on confirmStepUp, reconstructs the cart from the ledger and executes it", async () => {
    const chainId = "chain-fixed";
    getChainMock.mockResolvedValue([
      { chainId, seq: 1, type: "INTENT", payload: { rawAsk: "x" }, prevHash: "GENESIS", hash: "h1", createdAt: new Date() },
      {
        chainId,
        seq: 2,
        type: "CART",
        payload: { items: [{ sku: "FOOD-PBAR-001", category: "food", qty: 1, unitPriceInPaise: 60000 }], totalInPaise: 60000 },
        prevHash: "h1",
        hash: "h2",
        createdAt: new Date(),
      },
    ]);
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop: vi.fn(), razorpayAdapter });

    const result = await orchestrator.handleMessage({
      userId: "user-1",
      merchantId: "merchant-1",
      chainId,
      message: "yes",
      confirmStepUp: true,
    });

    expect(result).toMatchObject({ type: "executed", chainId, razorpayOrderId: "order_1" });
    expect(razorpayAdapter.createOrder).toHaveBeenCalledWith(60000, "INR", expect.any(String));
  });
});

describe("orchestrator.handleMessage — Failure Injector", () => {
  it("cap_breach: forces STEP_UP regardless of the item's real price", async () => {
    productFindMock.mockReturnValue(
      makeProductQuery([{ sku: "FOOD-PBAR-001", category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 5 }]),
    );
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "propose_cart", items: [{ sku: "FOOD-PBAR-001", qty: 1 }] });
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter });

    const result = await orchestrator.handleMessage({
      userId: "user-1",
      merchantId: "merchant-1",
      message: "get me a protein bar",
      forcedFailure: "cap_breach",
    });

    expect(result.type).toBe("step_up");
    if (result.type === "step_up") {
      expect(result.totalInPaise).toBeGreaterThan(CONSENT.spendCapPerTxn);
    }
    expect(razorpayAdapter.createOrder).not.toHaveBeenCalled();

    const cartCall = appendMandateMock.mock.calls.find((call) => call[1] === "CART");
    expect(cartCall?.[2]).toMatchObject({ forcedFailure: "cap_breach" });
  });

  it("decline: writes a break EXECUTION record, then still succeeds via the (real) retry", async () => {
    productFindMock.mockReturnValue(
      makeProductQuery([{ sku: "FOOD-PBAR-001", category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 5 }]),
    );
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "propose_cart", items: [{ sku: "FOOD-PBAR-001", qty: 1 }] });
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter });

    const result = await orchestrator.handleMessage({
      userId: "user-1",
      merchantId: "merchant-1",
      message: "get me a protein bar",
      forcedFailure: "decline",
    });

    expect(result).toMatchObject({ type: "executed", razorpayOrderId: "order_1" });
    expect(result.type === "executed" && result.note).toMatch(/declined/);

    const mandateTypes = appendMandateMock.mock.calls.map((call) => call[1]);
    expect(mandateTypes).toEqual(["INTENT", "CART", "EXECUTION", "PAYMENT", "EXECUTION"]);
    const breakRecord = appendMandateMock.mock.calls[2];
    expect(breakRecord[2]).toMatchObject({ result: "razorpay_declined" });
  });

  it("out_of_stock: writes a break record, substitutes an in-stock item, and executes it", async () => {
    productFindMock.mockReturnValue(
      makeProductQuery([{ sku: "FOOD-PBAR-001", category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 0 }]),
    );
    findInStockAlternativeMock.mockResolvedValue({ sku: "FOOD-PBAR-002", name: "Chocolate Protein Bar", priceInPaise: 9900, category: "food", stock: 10 });
    // second lookupProducts call (for the substitute sku)
    productFindMock.mockReturnValueOnce(
      makeProductQuery([{ sku: "FOOD-PBAR-001", category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 0 }]),
    ).mockReturnValueOnce(
      makeProductQuery([{ sku: "FOOD-PBAR-002", category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 10 }]),
    );
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "propose_cart", items: [{ sku: "FOOD-PBAR-001", qty: 1 }] });
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter });

    const result = await orchestrator.handleMessage({
      userId: "user-1",
      merchantId: "merchant-1",
      message: "get me a protein bar",
      forcedFailure: "out_of_stock",
    });

    expect(result).toMatchObject({ type: "executed" });
    expect(result.type === "executed" && result.note).toMatch(/FOOD-PBAR-002/);

    const mandateTypes = appendMandateMock.mock.calls.map((call) => call[1]);
    expect(mandateTypes).toEqual(["INTENT", "EXECUTION", "CART", "PAYMENT", "EXECUTION"]);
    const breakRecord = appendMandateMock.mock.calls[1];
    expect(breakRecord[2]).toMatchObject({ result: "out_of_stock", sku: "FOOD-PBAR-001" });
  });

  it("out_of_stock: denies gracefully when no substitute exists", async () => {
    productFindMock.mockReturnValue(
      makeProductQuery([{ sku: "FOOD-PBAR-001", category: "food", priceInPaise: 9900, maxQtyPerOrder: 10, stock: 0 }]),
    );
    findInStockAlternativeMock.mockResolvedValue(null);
    const runLlmLoop = vi.fn().mockResolvedValue({ type: "propose_cart", items: [{ sku: "FOOD-PBAR-001", qty: 1 }] });
    const razorpayAdapter = makeRazorpayAdapter();
    const orchestrator = createOrchestrator({ runLlmLoop, razorpayAdapter });

    const result = await orchestrator.handleMessage({
      userId: "user-1",
      merchantId: "merchant-1",
      message: "get me a protein bar",
      forcedFailure: "out_of_stock",
    });

    expect(result).toMatchObject({ type: "denied" });
    expect(razorpayAdapter.createOrder).not.toHaveBeenCalled();
  });
});
