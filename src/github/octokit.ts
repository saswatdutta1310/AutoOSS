import { Octokit } from "@octokit/rest";
import { z } from "zod";
import {
  AuthenticationError,
  ClosedIssueError,
  ForkResult,
  ForkTimeoutError,
  GitHubApiError,
  GitHubClient,
  Issue,
  IssueRef,
  IssueSchema,
  NotFoundError,
  PermissionError,
  PullRequestNotSupportedError,
  RateLimitError,
} from "./client.js";

export interface OctokitClientOptions {
  auth?: string;
  octokit?: Octokit;
  forkPollIntervalMs?: number;
  forkTimeoutMs?: number;
}

// Zod schemas for Octokit raw API responses
const OctokitUserResponseSchema = z.object({
  login: z.string(),
});

const OctokitIssueResponseSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string().nullable().optional(),
  state: z.string(),
  html_url: z.string().url(),
  labels: z.array(
    z.union([
      z.string(),
      z.object({
        name: z.string().optional(),
      }),
    ])
  ),
  pull_request: z.any().optional(),
});

const OctokitRepoResponseSchema = z.object({
  clone_url: z.string().url(),
  owner: z.object({
    login: z.string(),
  }),
  name: z.string(),
});

const OctokitContentFileResponseSchema = z.object({
  type: z.string(),
  content: z.string().optional(),
  encoding: z.string().optional(),
});

export class OctokitGitHubClient implements GitHubClient {
  private octokit: Octokit;
  private forkPollIntervalMs: number;
  private forkTimeoutMs: number;

  constructor(options: OctokitClientOptions = {}) {
    this.octokit = options.octokit ?? new Octokit({ auth: options.auth });
    this.forkPollIntervalMs = options.forkPollIntervalMs ?? 2000;
    this.forkTimeoutMs = options.forkTimeoutMs ?? 60000;
  }

  private mapError(err: unknown, resourceName?: string): never {
    if (err instanceof PullRequestNotSupportedError || err instanceof ClosedIssueError || err instanceof ForkTimeoutError) {
      throw err;
    }

    const anyErr = err as { status?: number; message?: string };
    const status = anyErr?.status;
    const msg = anyErr?.message || "";

    if (status === 401 || msg.includes("Bad credentials")) {
      throw new AuthenticationError("GitHub authentication failed. Check your GITHUB_TOKEN.");
    }
    if (status === 403) {
      if (msg.includes("rate limit") || msg.includes("secondary rate limit")) {
        throw new RateLimitError("GitHub API rate limit exceeded.");
      }
      throw new PermissionError("GitHub permission denied or rate limited.");
    }
    if (status === 404) {
      throw new NotFoundError(resourceName ? `GitHub resource not found: ${resourceName}` : "GitHub resource not found.");
    }
    if (status === 429) {
      throw new RateLimitError("GitHub API rate limit exceeded.");
    }

    throw new GitHubApiError(`GitHub API request failed: ${msg || "Unknown error"}`, status, err);
  }

  async getViewerLogin(): Promise<string> {
    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      const parsed = OctokitUserResponseSchema.parse(response.data);
      return parsed.login;
    } catch (err) {
      this.mapError(err, "authenticated user");
    }
  }

  async getIssue(ref: IssueRef): Promise<Issue> {
    try {
      const response = await this.octokit.rest.issues.get({
        owner: ref.owner,
        repo: ref.repo,
        issue_number: ref.number,
      });

      const raw = OctokitIssueResponseSchema.parse(response.data);

      if (raw.pull_request) {
        throw new PullRequestNotSupportedError(
          `URL points to a pull request (#${ref.number}), not an issue.`
        );
      }

      if (raw.state.toLowerCase() === "closed") {
        throw new ClosedIssueError(`Issue #${ref.number} in ${ref.owner}/${ref.repo} is closed.`);
      }

      const labels = raw.labels.map((l) => (typeof l === "string" ? l : l.name || "")).filter(Boolean);

      return IssueSchema.parse({
        owner: ref.owner,
        repo: ref.repo,
        number: raw.number,
        title: raw.title,
        body: raw.body ?? "",
        labels,
        state: raw.state,
        url: raw.html_url,
      });
    } catch (err) {
      this.mapError(err, `issue #${ref.number} in ${ref.owner}/${ref.repo}`);
    }
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      const parsed = OctokitContentFileResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        return null;
      }

      if (parsed.data.type === "file" && parsed.data.content) {
        return Buffer.from(parsed.data.content, "base64").toString("utf8");
      }
      return null;
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 404) {
        return null;
      }
      this.mapError(err, `file ${path} in ${owner}/${repo}`);
    }
  }

  async ensureFork(owner: string, repo: string): Promise<ForkResult> {
    const viewerLogin = await this.getViewerLogin();

    // If viewer owns repo, do not fork
    if (viewerLogin.toLowerCase() === owner.toLowerCase()) {
      const selfRepo = await this.getRepo(owner, repo);
      return {
        owner,
        repo,
        cloneUrl: selfRepo.clone_url,
        created: false,
      };
    }

    // Check if viewer already has a fork
    try {
      const existingFork = await this.getRepo(viewerLogin, repo);
      return {
        owner: viewerLogin,
        repo,
        cloneUrl: existingFork.clone_url,
        created: false,
      };
    } catch (err) {
      if (!(err instanceof NotFoundError)) {
        throw err;
      }
    }

    // Fork does not exist, trigger creation
    try {
      await this.octokit.rest.repos.createFork({
        owner,
        repo,
      });
    } catch (err) {
      this.mapError(err, `fork of ${owner}/${repo}`);
    }

    // Poll until ready
    const startTime = Date.now();
    while (Date.now() - startTime < this.forkTimeoutMs) {
      await new Promise((r) => setTimeout(r, this.forkPollIntervalMs));
      try {
        const checkRepo = await this.getRepo(viewerLogin, repo);
        return {
          owner: viewerLogin,
          repo,
          cloneUrl: checkRepo.clone_url,
          created: true,
        };
      } catch (err) {
        if (!(err instanceof NotFoundError)) {
          throw err;
        }
      }
    }

    throw new ForkTimeoutError(
      `Timed out after ${this.forkTimeoutMs}ms waiting for fork ${viewerLogin}/${repo} to become available.`
    );
  }

  private async getRepo(owner: string, repo: string): Promise<{ clone_url: string }> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });
      const parsed = OctokitRepoResponseSchema.parse(response.data);
      return { clone_url: parsed.clone_url };
    } catch (err) {
      this.mapError(err, `repository ${owner}/${repo}`);
    }
  }
}
