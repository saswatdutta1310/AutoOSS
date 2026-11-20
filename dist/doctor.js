import { Octokit } from "@octokit/rest";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "./config.js";
const execAsync = promisify(exec);
export async function runDoctor(deps = {}) {
    const results = [];
    // 1. Node version check (>= 20)
    try {
        const rawVersion = deps.nodeVersion ?? process.version;
        const major = parseInt(rawVersion.replace(/^v/, "").split(".")[0], 10);
        if (isNaN(major) || major < 20) {
            results.push({
                name: "Node.js Version",
                status: "fail",
                detail: `Detected ${rawVersion}. Version >= 20 is required.`,
            });
        }
        else {
            results.push({
                name: "Node.js Version",
                status: "pass",
                detail: `Detected ${rawVersion} (meets requirement >= 20).`,
            });
        }
    }
    catch (err) {
        results.push({
            name: "Node.js Version",
            status: "fail",
            detail: `Failed to check Node version: ${err instanceof Error ? err.message : String(err)}`,
        });
    }
    // 2. Docker reachable (run docker info with 5s timeout)
    try {
        const dockerRunner = deps.runDockerInfo ??
            (async () => {
                const { stdout } = await execAsync("docker info", { timeout: 5000 });
                return stdout;
            });
        await dockerRunner();
        results.push({
            name: "Docker",
            status: "pass",
            detail: "Docker daemon is running and reachable.",
        });
    }
    catch (err) {
        results.push({
            name: "Docker",
            status: "fail",
            detail: `Docker daemon unreachable or timed out: ${err instanceof Error ? err.message : String(err)}`,
        });
    }
    // Load config if not injected
    let config;
    try {
        config = deps.config ?? loadConfig();
    }
    catch {
        config = {
            GEMINI_API_KEY: undefined,
            GITHUB_TOKEN: undefined,
            AUTOOSS_MODEL: "gemini-2.5-flash",
            OLLAMA_URL: "http://localhost:11434",
            OLLAMA_MODEL: "",
        };
    }
    // 3. GEMINI_API_KEY present (presence check only, no network call)
    try {
        if (config.GEMINI_API_KEY && config.GEMINI_API_KEY.trim().length > 0) {
            results.push({
                name: "Gemini API Key",
                status: "pass",
                detail: "API key is configured.",
            });
        }
        else {
            results.push({
                name: "Gemini API Key",
                status: "warn",
                detail: "GEMINI_API_KEY is not set. Some features may not function.",
            });
        }
    }
    catch (err) {
        results.push({
            name: "Gemini API Key",
            status: "warn",
            detail: `Error verifying Gemini API key presence: ${err instanceof Error ? err.message : String(err)}`,
        });
    }
    // 4. GITHUB_TOKEN valid (GET /user via Octokit)
    try {
        const token = config.GITHUB_TOKEN?.trim();
        if (!token) {
            results.push({
                name: "GitHub Token",
                status: "warn",
                detail: "GITHUB_TOKEN is not set.",
            });
        }
        else {
            const verifier = deps.verifyGitHubToken ??
                (async (tok) => {
                    const octokit = new Octokit({ auth: tok });
                    const res = await octokit.rest.users.getAuthenticated();
                    return { login: res.data.login };
                });
            try {
                const user = await verifier(token);
                results.push({
                    name: "GitHub Token",
                    status: "pass",
                    detail: `Authenticated as ${user.login}.`,
                });
            }
            catch (err) {
                results.push({
                    name: "GitHub Token",
                    status: "fail",
                    detail: `Authentication failed: ${err instanceof Error ? err.message : String(err)}`,
                });
            }
        }
    }
    catch (err) {
        results.push({
            name: "GitHub Token",
            status: "fail",
            detail: `Token validation error: ${err instanceof Error ? err.message : String(err)}`,
        });
    }
    // 5. Ollama reachable at OLLAMA_URL (warn if unreachable, never fail)
    try {
        const ollamaUrl = config.OLLAMA_URL || "http://localhost:11434";
        const checker = deps.checkOllamaReachable ??
            (async (url) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                try {
                    const res = await fetch(url, { signal: controller.signal });
                    return res.ok || res.status < 500;
                }
                finally {
                    clearTimeout(timeoutId);
                }
            });
        const isReachable = await checker(ollamaUrl);
        if (isReachable) {
            results.push({
                name: "Ollama Instance",
                status: "pass",
                detail: `Reachable at ${ollamaUrl}.`,
            });
        }
        else {
            results.push({
                name: "Ollama Instance",
                status: "warn",
                detail: `Unreachable at ${ollamaUrl}.`,
            });
        }
    }
    catch {
        results.push({
            name: "Ollama Instance",
            status: "warn",
            detail: `Unreachable at ${config.OLLAMA_URL || "http://localhost:11434"}.`,
        });
    }
    return results;
}
