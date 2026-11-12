export interface AppConfig {
  githubToken?: string;
  geminiApiKey?: string;
  ollamaBaseUrl?: string;
  llmModel: string;
  enableDockerSandbox: boolean;
  enableSemgrep: boolean;
}

export function loadConfig(): AppConfig {
  return {
    githubToken: process.env.GITHUB_TOKEN,
    geminiApiKey: process.env.GEMINI_API_KEY,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    llmModel: process.env.LLM_MODEL || "gemini-1.5-pro",
    enableDockerSandbox: process.env.ENABLE_DOCKER_SANDBOX === "true",
    enableSemgrep: process.env.ENABLE_SEMGREP === "true",
  };
}
