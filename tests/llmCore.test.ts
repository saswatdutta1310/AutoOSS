import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  parseJsonOutput,
  generateValidated,
  LLMOutputError,
  LLMQuotaError,
  Usage,
} from "../src/llm/adapter";
import {
  TokenBucketRateLimiter,
  withRetry,
} from "../src/llm/rateLimiter";

describe("parseJsonOutput", () => {
  const schema = z.object({
    name: z.string(),
    count: z.number(),
  });

  it("parses plain JSON", () => {
    const raw = '{"name": "test", "count": 42}';
    const result = parseJsonOutput(raw, schema);
    expect(result).toEqual({ name: "test", count: 42 });
  });

  it("parses fenced JSON (with ```json markdown fences)", () => {
    const raw = "```json\n{\n  \"name\": \"fenced\",\n  \"count\": 10\n}\n```";
    const result = parseJsonOutput(raw, schema);
    expect(result).toEqual({ name: "fenced", count: 10 });
  });

  it("parses fenced JSON without language tag", () => {
    const raw = "```\n{\n  \"name\": \"no-tag\",\n  \"count\": 5\n}\n```";
    const result = parseJsonOutput(raw, schema);
    expect(result).toEqual({ name: "no-tag", count: 5 });
  });

  it("parses JSON surrounded by prose", () => {
    const raw = "Here is the response requested:\n{\"name\": \"prose\", \"count\": 99}\nHope this helps!";
    const result = parseJsonOutput(raw, schema);
    expect(result).toEqual({ name: "prose", count: 99 });
  });

  it("throws LLMOutputError on garbage text", () => {
    const raw = "Not a json at all! Just some random gibberish.";
    expect(() => parseJsonOutput(raw, schema)).toThrow(LLMOutputError);
  });

  it("throws LLMOutputError on schema mismatch without leaking secrets", () => {
    const raw = '{"name": "missing count"}';
    expect(() => parseJsonOutput(raw, schema)).toThrow(LLMOutputError);
    try {
      parseJsonOutput(raw, schema);
    } catch (err: any) {
      expect(err).toBeInstanceOf(LLMOutputError);
      expect(err.message).toContain("Output failed schema validation");
    }
  });
});

describe("generateValidated", () => {
  const schema = z.object({
    result: z.string(),
  });

  it("succeeds on first try if output is valid", async () => {
    const callModel = vi.fn().mockResolvedValue({
      raw: '{"result": "success"}',
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const res = await generateValidated(callModel, {
      system: "system prompt",
      prompt: "user prompt",
      schema,
    });

    expect(res.data).toEqual({ result: "success" });
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel).toHaveBeenCalledWith("system prompt\n\nuser prompt");
  });

  it("re-prompts ONCE when first response is invalid and succeeds if second is valid", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce({
        raw: '{"wrong": "field"}',
        usage: { inputTokens: 10, outputTokens: 5 },
      })
      .mockResolvedValueOnce({
        raw: '{"result": "recovered"}',
        usage: { inputTokens: 20, outputTokens: 8 },
      });

    const res = await generateValidated(callModel, {
      system: "sys",
      prompt: "do something",
      schema,
    });

    expect(res.data).toEqual({ result: "recovered" });
    expect(res.usage).toEqual({ inputTokens: 30, outputTokens: 13 });
    expect(callModel).toHaveBeenCalledTimes(2);

    const secondCallPrompt = callModel.mock.calls[1][0];
    expect(secondCallPrompt).toContain("Your previous response was invalid");
    expect(secondCallPrompt).toContain("result:");
  });

  it("fails after second invalid output with LLMOutputError", async () => {
    const callModel = vi
      .fn()
      .mockResolvedValueOnce({
        raw: "invalid first",
        usage: { inputTokens: 10, outputTokens: 5 },
      })
      .mockResolvedValueOnce({
        raw: "invalid second",
        usage: { inputTokens: 20, outputTokens: 5 },
      });

    await expect(
      generateValidated(callModel, {
        system: "",
        prompt: "test",
        schema,
      })
    ).rejects.toThrow(LLMOutputError);

    expect(callModel).toHaveBeenCalledTimes(2);
  });
});

describe("TokenBucketRateLimiter", () => {
  it("respects 10 RPM with a fake clock", async () => {
    let currentTime = 1000;
    const fakeClock = {
      now: () => currentTime,
    };
    const sleepCalls: number[] = [];
    const fakeSleep = async (ms: number) => {
      sleepCalls.push(ms);
      currentTime += ms;
    };

    const limiter = new TokenBucketRateLimiter(10, {
      clock: fakeClock,
      sleep: fakeSleep,
    });

    // We can acquire 10 tokens immediately
    for (let i = 0; i < 10; i++) {
      await limiter.acquire(1);
    }
    expect(sleepCalls.length).toBe(0);

    // 11th token should trigger sleep
    // 10 RPM = 1 token every 6000ms
    await limiter.acquire(1);
    expect(sleepCalls.length).toBe(1);
    expect(sleepCalls[0]).toBe(6000);
  });
});

describe("withRetry", () => {
  it("succeeds on first attempt without sleep", async () => {
    const sleepCalls: number[] = [];
    const fakeSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    const fn = vi.fn().mockResolvedValue("done");
    const result = await withRetry(fn, { sleep: fakeSleep });

    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleepCalls.length).toBe(0);
  });

  it("backs off on 429 and 5xx errors and eventually succeeds", async () => {
    const sleepCalls: number[] = [];
    const fakeSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    let count = 0;
    const fn = vi.fn().mockImplementation(async () => {
      count++;
      if (count === 1) {
        const err: any = new Error("Rate limit exceeded 429");
        err.status = 429;
        throw err;
      }
      if (count === 2) {
        const err: any = new Error("Internal Server Error");
        err.status = 503;
        throw err;
      }
      return "recovered";
    });

    const result = await withRetry(fn, {
      maxAttempts: 4,
      initialDelayMs: 100,
      backoffFactor: 2,
      sleep: fakeSleep,
      jitter: false,
    });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleepCalls).toEqual([100, 200]);
  });

  it("stops at max attempts and throws LLMQuotaError when retries are exhausted", async () => {
    const sleepCalls: number[] = [];
    const fakeSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    const fn = vi.fn().mockImplementation(async () => {
      const err: any = new Error("Rate limit 429");
      err.status = 429;
      throw err;
    });

    await expect(
      withRetry(fn, {
        maxAttempts: 4,
        initialDelayMs: 10,
        backoffFactor: 2,
        sleep: fakeSleep,
        jitter: false,
      })
    ).rejects.toThrow(LLMQuotaError);

    expect(fn).toHaveBeenCalledTimes(4);
    expect(sleepCalls.length).toBe(3);
  });

  it("throws LLMQuotaError immediately on daily-quota 429 error", async () => {
    const sleepCalls: number[] = [];
    const fakeSleep = async (ms: number) => {
      sleepCalls.push(ms);
    };

    const fn = vi.fn().mockImplementation(async () => {
      const err: any = new Error("Daily quota exceeded for model");
      err.status = 429;
      throw err;
    });

    await expect(
      withRetry(fn, {
        maxAttempts: 4,
        sleep: fakeSleep,
      })
    ).rejects.toThrow(LLMQuotaError);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleepCalls.length).toBe(0);
  });
});
