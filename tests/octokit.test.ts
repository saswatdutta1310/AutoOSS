import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  ClosedIssueError,
  ForkTimeoutError,
  NotFoundError,
  PullRequestNotSupportedError,
  RateLimitError,
} from "../src/github/client.js";
import { OctokitGitHubClient } from "../src/github/octokit.js";

describe("OctokitGitHubClient", () => {
  describe("getIssue", () => {
    it("returns parsed issue on success", async () => {
      const mockOctokit = {
        rest: {
          issues: {
            get: vi.fn().mockResolvedValue({
              data: {
                number: 42,
                title: "Bug in parser",
                body: "Steps to reproduce...",
                state: "open",
                html_url: "https://github.com/foo/bar/issues/42",
                labels: [{ name: "bug" }, "urgent"],
              },
            }),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      const issue = await client.getIssue({ owner: "foo", repo: "bar", number: 42 });

      expect(issue).toEqual({
        owner: "foo",
        repo: "bar",
        number: 42,
        title: "Bug in parser",
        body: "Steps to reproduce...",
        labels: ["bug", "urgent"],
        state: "open",
        url: "https://github.com/foo/bar/issues/42",
      });
    });

    it("rejects pull requests", async () => {
      const mockOctokit = {
        rest: {
          issues: {
            get: vi.fn().mockResolvedValue({
              data: {
                number: 10,
                title: "A pull request",
                body: "details",
                state: "open",
                html_url: "https://github.com/foo/bar/pull/10",
                labels: [],
                pull_request: { url: "https://api.github.com/repos/foo/bar/pulls/10" },
              },
            }),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      await expect(client.getIssue({ owner: "foo", repo: "bar", number: 10 })).rejects.toThrow(
        PullRequestNotSupportedError
      );
    });

    it("rejects closed issues", async () => {
      const mockOctokit = {
        rest: {
          issues: {
            get: vi.fn().mockResolvedValue({
              data: {
                number: 11,
                title: "Closed issue",
                body: "done",
                state: "closed",
                html_url: "https://github.com/foo/bar/issues/11",
                labels: [],
              },
            }),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      await expect(client.getIssue({ owner: "foo", repo: "bar", number: 11 })).rejects.toThrow(
        ClosedIssueError
      );
    });

    it("maps 404 to NotFoundError", async () => {
      const mockOctokit = {
        rest: {
          issues: {
            get: vi.fn().mockRejectedValue({ status: 404, message: "Not Found" }),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      await expect(client.getIssue({ owner: "foo", repo: "bar", number: 999 })).rejects.toThrow(
        NotFoundError
      );
    });

    it("maps 401 to AuthenticationError", async () => {
      const mockOctokit = {
        rest: {
          issues: {
            get: vi.fn().mockRejectedValue({ status: 401, message: "Bad credentials" }),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      await expect(client.getIssue({ owner: "foo", repo: "bar", number: 1 })).rejects.toThrow(
        AuthenticationError
      );
    });

    it("maps 403 rate limit to RateLimitError", async () => {
      const mockOctokit = {
        rest: {
          issues: {
            get: vi.fn().mockRejectedValue({
              status: 403,
              message: "API rate limit exceeded for user ID 123",
            }),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      await expect(client.getIssue({ owner: "foo", repo: "bar", number: 1 })).rejects.toThrow(
        RateLimitError
      );
    });
  });

  describe("ensureFork", () => {
    it("skips fork when viewer equals repo owner", async () => {
      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: vi.fn().mockResolvedValue({ data: { login: "alice" } }),
          },
          repos: {
            get: vi.fn().mockResolvedValue({
              data: {
                name: "my-project",
                owner: { login: "alice" },
                clone_url: "https://github.com/alice/my-project.git",
              },
            }),
            createFork: vi.fn(),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      const fork = await client.ensureFork("alice", "my-project");

      expect(fork).toEqual({
        owner: "alice",
        repo: "my-project",
        cloneUrl: "https://github.com/alice/my-project.git",
        created: false,
      });
      expect(mockOctokit.rest.repos.createFork).not.toHaveBeenCalled();
    });

    it("reuses existing fork if present", async () => {
      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: vi.fn().mockResolvedValue({ data: { login: "alice" } }),
          },
          repos: {
            get: vi.fn().mockImplementation(async ({ owner, repo }) => {
              if (owner === "alice" && repo === "upstream-proj") {
                return {
                  data: {
                    name: "upstream-proj",
                    owner: { login: "alice" },
                    clone_url: "https://github.com/alice/upstream-proj.git",
                  },
                };
              }
              throw { status: 404 };
            }),
            createFork: vi.fn(),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({ octokit: mockOctokit });
      const fork = await client.ensureFork("bob", "upstream-proj");

      expect(fork).toEqual({
        owner: "alice",
        repo: "upstream-proj",
        cloneUrl: "https://github.com/alice/upstream-proj.git",
        created: false,
      });
      expect(mockOctokit.rest.repos.createFork).not.toHaveBeenCalled();
    });

    it("creates fork and polls until ready", async () => {
      let pollCount = 0;
      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: vi.fn().mockResolvedValue({ data: { login: "alice" } }),
          },
          repos: {
            get: vi.fn().mockImplementation(async ({ owner, repo }) => {
              if (owner === "alice") {
                pollCount++;
                if (pollCount <= 2) {
                  throw { status: 404, message: "Not Found" };
                }
                return {
                  data: {
                    name: "upstream-proj",
                    owner: { login: "alice" },
                    clone_url: "https://github.com/alice/upstream-proj.git",
                  },
                };
              }
              throw { status: 404 };
            }),
            createFork: vi.fn().mockResolvedValue({}),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({
        octokit: mockOctokit,
        forkPollIntervalMs: 10,
        forkTimeoutMs: 1000,
      });

      const fork = await client.ensureFork("bob", "upstream-proj");

      expect(fork).toEqual({
        owner: "alice",
        repo: "upstream-proj",
        cloneUrl: "https://github.com/alice/upstream-proj.git",
        created: true,
      });
      expect(mockOctokit.rest.repos.createFork).toHaveBeenCalledWith({
        owner: "bob",
        repo: "upstream-proj",
      });
    });

    it("throws ForkTimeoutError if fork does not become ready in time", async () => {
      const mockOctokit = {
        rest: {
          users: {
            getAuthenticated: vi.fn().mockResolvedValue({ data: { login: "alice" } }),
          },
          repos: {
            get: vi.fn().mockRejectedValue({ status: 404, message: "Not Found" }),
            createFork: vi.fn().mockResolvedValue({}),
          },
        },
      } as any;

      const client = new OctokitGitHubClient({
        octokit: mockOctokit,
        forkPollIntervalMs: 10,
        forkTimeoutMs: 50,
      });

      await expect(client.ensureFork("bob", "upstream-proj")).rejects.toThrow(ForkTimeoutError);
    });
  });
});
