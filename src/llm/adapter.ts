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
