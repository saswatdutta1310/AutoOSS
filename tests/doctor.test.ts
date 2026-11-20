import { describe, expect, it, vi } from "vitest";
import { runDoctor } from "../src/doctor.js";

describe("doctor", () => {
  it("passes all checks when all dependencies are healthy", async () => {
    const results = await runDoctor({
      nodeVersion: "v20.11.0",
      runDockerInfo: vi.fn().mockResolvedValue("Docker version 24.0.7"),
      verifyGitHubToken: vi.fn().mockResolvedValue({ login: "octocat" }),
      checkOllamaReachable: vi.fn().mockResolvedValue(true),
      config: {
        GEMINI_API_KEY: "AIzaSySecretGeminiKey123",
        GITHUB_TOKEN: "ghp_ValidGitHubToken456",
        AUTOOSS_MODEL: "gemini-2.5-flash",
        OLLAMA_URL: "http://localhost:11434",
        OLLAMA_MODEL: "",
      },
    });

    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.status).toBe("pass");
      expect(r.detail).not.toContain("AIzaSySecretGeminiKey123");
      expect(r.detail).not.toContain("ghp_ValidGitHubToken456");
    }
  });

  it("fails when node version is < 20", async () => {
    const results = await runDoctor({
      nodeVersion: "v18.19.0",
      runDockerInfo: vi.fn().mockResolvedValue("ok"),
      config: {
        GEMINI_API_KEY: "key",
        GITHUB_TOKEN: "token",
        AUTOOSS_MODEL: "gemini-2.5-flash",
        OLLAMA_URL: "http://localhost:11434",
        OLLAMA_MODEL: "",
      },
    });

    const nodeCheck = results.find((r) => r.name === "Node.js Version");
    expect(nodeCheck?.status).toBe("fail");
    expect(nodeCheck?.detail).toContain("Detected v18.19.0");
  });

  it("fails when docker info throws or times out", async () => {
    const results = await runDoctor({
      nodeVersion: "v22.0.0",
      runDockerInfo: vi.fn().mockRejectedValue(new Error("Command timed out after 5000ms")),
    });

    const dockerCheck = results.find((r) => r.name === "Docker");
    expect(dockerCheck?.status).toBe("fail");
    expect(dockerCheck?.detail).toContain("timed out");
  });

  it("warns when GEMINI_API_KEY is missing", async () => {
    const results = await runDoctor({
      nodeVersion: "v20.0.0",
      runDockerInfo: vi.fn().mockResolvedValue("ok"),
      config: {
        GEMINI_API_KEY: undefined,
        GITHUB_TOKEN: "ghp_tok",
        AUTOOSS_MODEL: "gemini-2.5-flash",
        OLLAMA_URL: "http://localhost:11434",
        OLLAMA_MODEL: "",
      },
      verifyGitHubToken: vi.fn().mockResolvedValue({ login: "user" }),
    });

    const geminiCheck = results.find((r) => r.name === "Gemini API Key");
    expect(geminiCheck?.status).toBe("warn");
  });

  it("warns when GITHUB_TOKEN is missing", async () => {
    const results = await runDoctor({
      nodeVersion: "v20.0.0",
      runDockerInfo: vi.fn().mockResolvedValue("ok"),
      config: {
        GEMINI_API_KEY: "key",
        GITHUB_TOKEN: undefined,
        AUTOOSS_MODEL: "gemini-2.5-flash",
        OLLAMA_URL: "http://localhost:11434",
        OLLAMA_MODEL: "",
      },
    });

    const ghCheck = results.find((r) => r.name === "GitHub Token");
    expect(ghCheck?.status).toBe("warn");
    expect(ghCheck?.detail).toContain("not set");
  });

  it("fails when GITHUB_TOKEN is invalid (Octokit throws)", async () => {
    const results = await runDoctor({
      nodeVersion: "v20.0.0",
      runDockerInfo: vi.fn().mockResolvedValue("ok"),
      config: {
        GEMINI_API_KEY: "key",
        GITHUB_TOKEN: "bad_secret_token_val",
        AUTOOSS_MODEL: "gemini-2.5-flash",
        OLLAMA_URL: "http://localhost:11434",
        OLLAMA_MODEL: "",
      },
      verifyGitHubToken: vi.fn().mockRejectedValue(new Error("Bad credentials (HTTP 401)")),
    });

    const ghCheck = results.find((r) => r.name === "GitHub Token");
    expect(ghCheck?.status).toBe("fail");
    expect(ghCheck?.detail).toContain("Bad credentials");
    expect(ghCheck?.detail).not.toContain("bad_secret_token_val");
  });

  it("warns (never fails) when Ollama is unreachable or throws", async () => {
    const results = await runDoctor({
      nodeVersion: "v20.0.0",
      runDockerInfo: vi.fn().mockResolvedValue("ok"),
      checkOllamaReachable: vi.fn().mockResolvedValue(false),
    });

    const ollamaCheck = results.find((r) => r.name === "Ollama Instance");
    expect(ollamaCheck?.status).toBe("warn");

    // Also test when checker throws
    const throwingResults = await runDoctor({
      nodeVersion: "v20.0.0",
      runDockerInfo: vi.fn().mockResolvedValue("ok"),
      checkOllamaReachable: vi.fn().mockRejectedValue(new Error("Connection refused")),
    });

    const ollamaThrowCheck = throwingResults.find((r) => r.name === "Ollama Instance");
    expect(ollamaThrowCheck?.status).toBe("warn");
  });
});
