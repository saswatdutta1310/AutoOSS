import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
export async function createRunDir(owner, repo, issueNumber) {
    const sanitizePart = (val, name) => {
        if (!val || typeof val !== "string") {
            throw new Error(`Invalid ${name}: must be a non-empty string`);
        }
        if (val.includes("..") || val.includes("/") || val.includes("\\")) {
            throw new Error(`Path traversal detected in ${name}: "${val}"`);
        }
        // Reject anything not safe for folder names
        if (!/^[a-zA-Z0-9_.-]+$/.test(val)) {
            throw new Error(`Invalid characters in ${name}: "${val}"`);
        }
        return val;
    };
    const safeOwner = sanitizePart(owner, "owner");
    const safeRepo = sanitizePart(repo, "repo");
    const safeIssue = sanitizePart(String(issueNumber), "issueNumber");
    const timestamp = Date.now();
    const folderName = `${safeOwner}-${safeRepo}-${safeIssue}-${timestamp}`;
    const home = os.homedir();
    const targetDir = path.join(home, ".autooss", "runs", folderName);
    // Additional sanity check that targetDir stays within ~/.autooss/runs
    const runsRoot = path.join(home, ".autooss", "runs");
    const resolved = path.resolve(targetDir);
    if (!resolved.startsWith(path.resolve(runsRoot))) {
        throw new Error(`Path traversal attempt detected: ${resolved}`);
    }
    await fs.mkdir(resolved, { recursive: true });
    return resolved;
}
