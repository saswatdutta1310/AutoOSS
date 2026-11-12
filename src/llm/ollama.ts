import { LLMAdapter, LLMMessage, LLMResponse } from "./adapter";

export class OllamaAdapter implements LLMAdapter {
  constructor(private baseUrl: string = "http://localhost:11434", private model: string = "llama3") {}

  async complete(messages: LLMMessage[]): Promise<LLMResponse> {
    return {
      content: "Ollama completion placeholder",
    };
  }
}
