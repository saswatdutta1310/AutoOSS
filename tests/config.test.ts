import { describe, expect, it } from "vitest";
import { ConfigSchema, loadConfig, redact } from "../src/config.js";

describe("config", () => {
  describe("redact", () => {
    it("handles null, undefined, empty string", () => {
      expect(redact(null)).toBe("");
      expect(redact(undefined)).toBe("");
      expect(redact("")).toBe("");
    });

    it("masks short strings <= 4 chars completely", () => {
      expect(redact("a")).toBe("*");
      expect(redact("ab")).toBe("**");
      expect(redact("abc")).toBe("***");
      expect(redact("abcd")).toBe("****");
    });

    it("masks strings > 4 chars leaving only last 4 chars", () => {
      expect(redact("12345")).toBe("*2345");
      expect(redact("ghp_secretToken123456789")).toBe("********************6789");
      expect(redact("sk-ant-api03-abcdef1234")).toBe("*******************1234");
    });
  });

  describe("ConfigSchema", () => {
    it("provides defaults for model and ollama url", () => {
      const parsed = ConfigSchema.parse({});
      expect(parsed.AUTOOSS_MODEL).toBe("gemini-2.5-flash");
      expect(parsed.OLLAMA_URL).toBe("http://localhost:11434");
      expect(parsed.OLLAMA_MODEL).toBe("");
      expect(parsed.GEMINI_API_KEY).toBeUndefined();
      expect(parsed.GITHUB_TOKEN).toBeUndefined();
    });

    it("rejects invalid OLLAMA_URL format", () => {
      expect(() =>
        ConfigSchema.parse({
          OLLAMA_URL: "not-a-valid-url",
        })
      ).toThrow();
    });

    it("allows optional GEMINI_API_KEY and GITHUB_TOKEN", () => {
      const parsed = ConfigSchema.parse({
        GEMINI_API_KEY: "test-gemini-key",
        GITHUB_TOKEN: "test-gh-token",
      });
      expect(parsed.GEMINI_API_KEY).toBe("test-gemini-key");
      expect(parsed.GITHUB_TOKEN).toBe("test-gh-token");
    });
  });

  describe("loadConfig", () => {
    it("loads configuration successfully", () => {
      const config = loadConfig();
      expect(config).toBeDefined();
      expect(config.AUTOOSS_MODEL).toBeDefined();
    });
  });
});
