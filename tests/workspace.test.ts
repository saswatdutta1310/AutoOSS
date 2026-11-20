import { describe, expect, it } from "vitest";
import { createRunDir } from "../src/github/workspace.js";

describe("createRunDir", () => {
  it("creates a safe directory under ~/.autooss/runs", async () => {
    const dir = await createRunDir("owner", "repo", 123);
    expect(dir).toContain(".autooss");
    expect(dir).toContain("runs");
    expect(dir).toContain("owner-repo-123-");
  });

  it("rejects path traversal in owner", async () => {
    await expect(createRunDir("../owner", "repo", 123)).rejects.toThrow(/traversal|invalid/i);
    await expect(createRunDir("..\\owner", "repo", 123)).rejects.toThrow(/traversal|invalid/i);
  });

  it("rejects path traversal in repo", async () => {
    await expect(createRunDir("owner", "../../repo", 123)).rejects.toThrow(/traversal|invalid/i);
  });

  it("rejects path traversal in issueNumber", async () => {
    await expect(createRunDir("owner", "repo", "../123" as any)).rejects.toThrow(/traversal|invalid/i);
  });

  it("rejects invalid characters in parameters", async () => {
    await expect(createRunDir("owner/hack", "repo", 123)).rejects.toThrow(/traversal|invalid/i);
    await expect(createRunDir("owner", "repo;rm -rf", 123)).rejects.toThrow(/invalid/i);
  });
});
