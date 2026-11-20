import fs from "node:fs/promises";
import { simpleGit } from "simple-git";
export class SimpleGitOps {
    async cloneRepo(cloneUrl, destDir) {
        // 1. Sanitize clone URL: ensure no auth credentials/tokens embedded
        let parsedUrl;
        try {
            parsedUrl = new URL(cloneUrl);
        }
        catch {
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
        }
        catch (err) {
            if (err.code !== "ENOENT") {
                throw err;
            }
            // If it doesn't exist, create it
            await fs.mkdir(destDir, { recursive: true });
        }
        const git = simpleGit();
        await git.clone(cloneUrl, destDir);
    }
    async createBranch(repoPath, branchName) {
        const git = simpleGit(repoPath);
        await git.checkoutLocalBranch(branchName);
    }
    async getCurrentBranch(repoPath) {
        const git = simpleGit(repoPath);
        const branchSummary = await git.branch();
        return branchSummary.current;
    }
}
