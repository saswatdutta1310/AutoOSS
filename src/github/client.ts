import { z } from "zod";

export const IssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  number: z.number().int().positive(),
  title: z.string(),
  body: z.string().nullable().optional().transform((val) => val ?? ""),
  labels: z.array(z.string()),
  state: z.string(),
  url: z.string().url(),
});

export type Issue = z.infer<typeof IssueSchema>;

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
}

export interface ForkResult {
  owner: string;
  repo: string;
  cloneUrl: string;
  created: boolean;
}

export interface GitHubClient {
  getViewerLogin(): Promise<string>;
  getIssue(ref: IssueRef): Promise<Issue>;
  getFileContent(owner: string, repo: string, path: string): Promise<string | null>;
  ensureFork(owner: string, repo: string): Promise<ForkResult>;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "GitHubApiError";
    Object.setPrototypeOf(this, GitHubApiError.prototype);
  }
}

export class AuthenticationError extends GitHubApiError {
  constructor(message: string = "GitHub authentication failed. Check your GITHUB_TOKEN.") {
    super(message, 401);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class PermissionError extends GitHubApiError {
  constructor(message: string = "GitHub permission denied or rate limited. Check token permissions.") {
    super(message, 403);
    this.name = "PermissionError";
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

export class RateLimitError extends GitHubApiError {
  constructor(message: string = "GitHub API rate limit exceeded.") {
    super(message, 429);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class NotFoundError extends GitHubApiError {
  constructor(message: string = "GitHub resource not found.") {
    super(message, 404);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class PullRequestNotSupportedError extends Error {
  constructor(message: string = "Pull requests are not supported. Expected an issue.") {
    super(message);
    this.name = "PullRequestNotSupportedError";
    Object.setPrototypeOf(this, PullRequestNotSupportedError.prototype);
  }
}

export class ClosedIssueError extends Error {
  constructor(message: string = "The specified issue is closed.") {
    super(message);
    this.name = "ClosedIssueError";
    Object.setPrototypeOf(this, ClosedIssueError.prototype);
  }
}

export class ForkTimeoutError extends Error {
  constructor(message: string = "Timed out waiting for repository fork to become ready.") {
    super(message);
    this.name = "ForkTimeoutError";
    Object.setPrototypeOf(this, ForkTimeoutError.prototype);
  }
}
