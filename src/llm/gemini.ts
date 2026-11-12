import { LLMAdapter, LLMMessage, LLMResponse } from "./adapter";

export class GeminiAdapter implements LLMAdapter {
  constructor(private apiKey?: string, private model: string = "gemini-1.5-pro") {}

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    return {
      content: "Gemini completion placeholder",
    };
  }
}
