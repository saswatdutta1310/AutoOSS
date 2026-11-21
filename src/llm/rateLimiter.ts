import { LLMQuotaError } from "./adapter";

export interface RateLimiterClock {
  now(): number;
}

export type SleepFn = (ms: number) => Promise<void>;

export class TokenBucketRateLimiter {
  private capacity: number;
  private tokens: number;
  private refillRatePerMs: number;
  private lastRefill: number;
  private clock: RateLimiterClock;
  private sleep: SleepFn;

  constructor(
    requestsPerMinute: number = 10,
    options?: {
      clock?: RateLimiterClock;
      sleep?: SleepFn;
    }
  ) {
    this.capacity = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRatePerMs = requestsPerMinute / 60000;
    this.clock = options?.clock ?? { now: () => Date.now() };
    this.sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.lastRefill = this.clock.now();
  }

  private refill(): void {
    const now = this.clock.now();
    const elapsed = Math.max(0, now - this.lastRefill);
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerMs);
      this.lastRefill = now;
    }
  }

  async acquire(tokens: number = 1): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }
      const needed = tokens - this.tokens;
      const waitMs = Math.ceil(needed / this.refillRatePerMs);
      await this.sleep(Math.max(1, waitMs));
    }
  }
}

// Alias for backwards compatibility
export const RateLimiter = TokenBucketRateLimiter;

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  sleep?: SleepFn;
  jitter?: boolean;
}

export function isDailyQuotaError(error: any): boolean {
  const message = String(error?.message || error?.statusText || error || "").toLowerCase();
  return (
    message.includes("daily") ||
    message.includes("quota exceeded") ||
    message.includes("per-day") ||
    message.includes("daily limit")
  );
}

export function isRetryableError(error: any): { retryable: boolean; status?: number } {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status;
  const message = String(error?.message || "").toLowerCase();

  if (status === 429) {
    return { retryable: true, status: 429 };
  }
  if (typeof status === "number" && status >= 500 && status <= 599) {
    return { retryable: true, status };
  }

  if (message.includes("429") || message.includes("too many requests") || message.includes("rate limit")) {
    return { retryable: true, status: 429 };
  }
  if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
    return { retryable: true, status: 500 };
  }

  return { retryable: false, status };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 4;
  const initialDelayMs = opts?.initialDelayMs ?? 1000;
  const backoffFactor = opts?.backoffFactor ?? 2;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const useJitter = opts?.jitter ?? true;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (err: any) {
      const { retryable, status } = isRetryableError(err);

      // Check if 429 mentions a daily quota -> immediately throw LLMQuotaError
      if (status === 429 && isDailyQuotaError(err)) {
        throw new LLMQuotaError(`LLM daily quota exceeded: ${err?.message || "429"}`);
      }

      if (!retryable || attempt >= maxAttempts) {
        if (retryable && (status === 429 || attempt >= maxAttempts)) {
          throw new LLMQuotaError(
            `LLM quota or rate limit retries exhausted (${attempt}/${maxAttempts}): ${err?.message || "Too many requests"}`
          );
        }
        throw err;
      }

      // Calculate backoff with jitter
      const jitterMultiplier = useJitter ? 0.75 + Math.random() * 0.5 : 1.0;
      const waitMs = Math.round(delay * jitterMultiplier);
      await sleep(waitMs);
      delay *= backoffFactor;
    }
  }
}
