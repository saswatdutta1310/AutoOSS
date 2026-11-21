import { z, ZodType } from "zod";

export type Usage = {
  inputTokens: number;
  outputTokens: number;
};

export interface LLMProvider {
  generate<T>(req: {
    system: string;
    prompt: string;
    schema: ZodType<T>;
  }): Promise<{ data: T; usage: Usage }>;
}

export class LLMQuotaError extends Error {
  constructor(message: string = "LLM quota exceeded") {
    super(message);
    this.name = "LLMQuotaError";
  }
}

export class LLMAuthError extends Error {
  constructor(message: string = "LLM authentication failed") {
    super(message);
    this.name = "LLMAuthError";
  }
}

export class LLMOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMOutputError";
  }
}

export class LLMTimeoutError extends Error {
  constructor(message: string = "LLM request timed out") {
    super(message);
    this.name = "LLMTimeoutError";
  }
}

// Deprecated legacy interfaces kept for backward compatibility with existing placeholders
export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: number;
}

export interface LLMAdapter {
  complete(messages: LLMMessage[]): Promise<LLMResponse>;
}

export function parseJsonOutput<T>(raw: string, schema: ZodType<T>): T {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  // Matches ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    // If no code fence, but JSON object or array is surrounded by prose
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      cleaned = jsonMatch[0].trim();
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new LLMOutputError("Failed to parse LLM output as JSON");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues || [];
    const errorSummary = issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") || result.error.message;
    throw new LLMOutputError(`Output failed schema validation: ${errorSummary}`);
  }

  return result.data;
}

export async function generateValidated<T>(
  callModel: (prompt: string) => Promise<{ raw: string; usage: Usage }>,
  req: { system: string; prompt: string; schema: ZodType<T> }
): Promise<{ data: T; usage: Usage }> {
  let totalUsage: Usage = { inputTokens: 0, outputTokens: 0 };

  const fullPrompt = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;
  const firstRes = await callModel(fullPrompt);
  totalUsage = {
    inputTokens: totalUsage.inputTokens + (firstRes.usage?.inputTokens ?? 0),
    outputTokens: totalUsage.outputTokens + (firstRes.usage?.outputTokens ?? 0),
  };

  try {
    const data = parseJsonOutput(firstRes.raw, req.schema);
    return { data, usage: totalUsage };
  } catch (firstErr) {
    if (!(firstErr instanceof LLMOutputError)) {
      throw firstErr;
    }

    // Re-prompt ONCE including the validation error text
    const rePrompt = `${fullPrompt}\n\nYour previous response was invalid with the following error:\n${firstErr.message}\nPlease provide a valid response matching the required schema.`;
    const secondRes = await callModel(rePrompt);
    totalUsage = {
      inputTokens: totalUsage.inputTokens + (secondRes.usage?.inputTokens ?? 0),
      outputTokens: totalUsage.outputTokens + (secondRes.usage?.outputTokens ?? 0),
    };

    try {
      const data = parseJsonOutput(secondRes.raw, req.schema);
      return { data, usage: totalUsage };
    } catch (secondErr) {
      if (secondErr instanceof LLMOutputError) {
        throw secondErr;
      }
      throw new LLMOutputError("LLM response validation failed after retry");
    }
  }
}
