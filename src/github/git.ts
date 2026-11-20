import fs from "node:fs/promises";
import { simpleGit, SimpleGit } from "simple-git";

export interface GitOps {
  cloneRepo(cloneUrl: string, destDir: string): Promise<void>;
  createBranch(repoPath: string, branchName: string): Promise<void>;
  getCurrentBranch(repoPath: string): Promise<string>;
}

export class SimpleGitOps implements GitOps {
  async cloneRepo(cloneUrl: string, destDir: string): Promise<void> {
    // 1. Sanitize clone URL: ensure no auth credentials/tokens embedded
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cloneUrl);
    } catch {
      throw new Error(`Invalid clone URL: ${cloneUrl}`);
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new Error("Clone URL must not contain embedded authentication credentials or tokens.");
    }

    // 2. Refuse to clone into non-empty directory
    try {
      const files = await fs.readdir(destDir);
      if (files.length > 0) {
        throw new Error(`Refusing to clone into non-empty directory: ${destDir}`);
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      // If it doesn't exist, create it
      await fs.mkdir(destDir, { recursive: true });
    }

    const git: SimpleGit = simpleGit();
    await git.clone(cloneUrl, destDir);
  }

  async createBranch(repoPath: string, branchName: string): Promise<void> {
    const git: SimpleGit = simpleGit(repoPath);
    await git.checkoutLocalBranch(branchName);
  }

  async getCurrentBranch(repoPath: string): Promise<string> {
    const git: SimpleGit = simpleGit(repoPath);
    const branchSummary = await git.branch();
    return branchSummary.current;
  }
}
