import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { simpleGit } from "simple-git";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SimpleGitOps } from "../src/github/git.js";

describe("SimpleGitOps integration test (local temp repo)", () => {
  let tempRoot: string;
  let remoteRepoDir: string;
  let targetCloneDir: string;
  let gitOps: SimpleGitOps;

  beforeEach(async () => {
    gitOps = new SimpleGitOps();
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "autooss-git-test-"));
    remoteRepoDir = path.join(tempRoot, "upstream");
    targetCloneDir = path.join(tempRoot, "cloned");

    // Initialize local repo to act as remote
    await fs.mkdir(remoteRepoDir, { recursive: true });
    const git = simpleGit(remoteRepoDir);
    await git.init();
    await git.addConfig("user.name", "Test Runner");
    await git.addConfig("user.email", "test@example.com");

    // Commit an initial file
    await fs.writeFile(path.join(remoteRepoDir, "README.md"), "# Test Remote", "utf8");
    await git.add(".");
    await git.commit("initial commit");
  });

  afterEach(async () => {
    try {
      await fs.rm(tempRoot, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it("refuses to clone into a non-empty directory", async () => {
    // Create destination dir with an existing file
    await fs.mkdir(targetCloneDir, { recursive: true });
    await fs.writeFile(path.join(targetCloneDir, "existing.txt"), "hello", "utf8");

    const fileUrl = pathToFileURL(remoteRepoDir).href;
    await expect(gitOps.cloneRepo(fileUrl, targetCloneDir)).rejects.toThrow(
      /Refusing to clone into non-empty directory/
    );
  });

  it("successfully clones and creates a branch in local repository", async () => {
    const fileUrl = pathToFileURL(remoteRepoDir).href;
    await gitOps.cloneRepo(fileUrl, targetCloneDir);

    // Verify files exist in clone
    const readme = await fs.readFile(path.join(targetCloneDir, "README.md"), "utf8");
    expect(readme).toBe("# Test Remote");

    // Create a new branch
    const branchName = "autooss/issue-1-test-fix";
    await gitOps.createBranch(targetCloneDir, branchName);

    // Verify current branch is the new branch
    const currentBranch = await gitOps.getCurrentBranch(targetCloneDir);
    expect(currentBranch).toBe(branchName);
  });

  it("rejects clone URL with embedded credentials", async () => {
    const badUrl = "https://user:secret@github.com/owner/repo.git";
    await expect(gitOps.cloneRepo(badUrl, targetCloneDir)).rejects.toThrow(
      /must not contain embedded authentication credentials/
    );
  });
});
