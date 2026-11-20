import { describe, expect, it, vi } from "vitest";
import { AgentEventType } from "../src/events.js";
import { ingestIssue } from "../src/github/ingest.js";

describe("ingestIssue", () => {
  const validUrl = "https://github.com/facebook/react/issues/12345";

  const createMockDeps = () => {
    return {
      gitHubClient: {
        getViewerLogin: vi.fn().mockResolvedValue("my-user"),
        getIssue: vi.fn().mockResolvedValue({
          owner: "facebook",
          repo: "react",
          number: 12345,
          title: "State hook bug",
          body: "details",
          labels: ["bug"],
          state: "open",
          url: validUrl,
        }),
        getFileContent: vi.fn().mockResolvedValue("# Contributing Guidelines"),
        ensureFork: vi.fn().mockResolvedValue({
          owner: "my-user",
          repo: "react",
          cloneUrl: "https://github.com/my-user/react.git",
          created: true,
        }),
      },
      gitOps: {
        cloneRepo: vi.fn().mockResolvedValue(undefined),
        createBranch: vi.fn().mockResolvedValue(undefined),
        getCurrentBranch: vi.fn().mockResolvedValue("autooss/issue-12345-state-hook-bug"),
      },
      createRunDir: vi.fn().mockResolvedValue("/tmp/autooss/runs/facebook-react-12345-123"),
      makeBranchName: vi.fn().mockReturnValue("autooss/issue-12345-state-hook-bug"),
    };
  };

  it("happy path executes all steps and emits events in correct order", async () => {
    const deps = createMockDeps();
    const emittedEvents: Array<{ event: string; payload: any }> = [];
    const emit = (event: AgentEventType, payload: any) => {
      emittedEvents.push({ event, payload });
    };

    const result = await ingestIssue(deps, validUrl, emit);

    expect(result.issue.number).toBe(12345);
    expect(result.contributing).toBe("# Contributing Guidelines");
    expect(result.repoPath).toBe("/tmp/autooss/runs/facebook-react-12345-123");
    expect(result.branch).toBe("autooss/issue-12345-state-hook-bug");
    expect(result.forkOwner).toBe("my-user");
    expect(result.forkRepo).toBe("react");

    // Verify dependencies were called
    expect(deps.gitHubClient.getViewerLogin).toHaveBeenCalled();
    expect(deps.gitHubClient.getIssue).toHaveBeenCalledWith({
      owner: "facebook",
      repo: "react",
      number: 12345,
    });
    expect(deps.gitHubClient.ensureFork).toHaveBeenCalledWith("facebook", "react");
    expect(deps.gitOps.cloneRepo).toHaveBeenCalledWith(
      "https://github.com/my-user/react.git",
      "/tmp/autooss/runs/facebook-react-12345-123"
    );
    expect(deps.gitOps.createBranch).toHaveBeenCalledWith(
      "/tmp/autooss/runs/facebook-react-12345-123",
      "autooss/issue-12345-state-hook-bug"
    );

    // Verify event ordering
    expect(emittedEvents[0]).toEqual({
      event: "phase_started",
      payload: { phase: "ingest", description: "Starting issue ingestion" },
    });
    const lastEvent = emittedEvents[emittedEvents.length - 1];
    expect(lastEvent).toEqual({
      event: "phase_finished",
      payload: { phase: "ingest", success: true },
    });
  });

  it("failure at parseIssueUrl stops the pipeline and emits error", async () => {
    const deps = createMockDeps();
    const emittedEvents: Array<{ event: string; payload: any }> = [];
    const emit = (event: AgentEventType, payload: any) => {
      emittedEvents.push({ event, payload });
    };

    await expect(ingestIssue(deps, "https://invalid-url", emit)).rejects.toThrow();

    expect(deps.gitHubClient.getViewerLogin).not.toHaveBeenCalled();
    const finishEvent = emittedEvents.find((e) => e.event === "phase_finished");
    expect(finishEvent?.payload.success).toBe(false);
  });

  it("failure at getIssue stops the pipeline and emits error", async () => {
    const deps = createMockDeps();
    deps.gitHubClient.getIssue.mockRejectedValue(new Error("Issue not found"));

    const emittedEvents: Array<{ event: string; payload: any }> = [];
    const emit = (event: AgentEventType, payload: any) => {
      emittedEvents.push({ event, payload });
    };

    await expect(ingestIssue(deps, validUrl, emit)).rejects.toThrow("Issue not found");

    expect(deps.gitHubClient.ensureFork).not.toHaveBeenCalled();
    expect(deps.gitOps.cloneRepo).not.toHaveBeenCalled();

    const finishEvent = emittedEvents.find((e) => e.event === "phase_finished");
    expect(finishEvent?.payload.success).toBe(false);
    expect(finishEvent?.payload.error).toContain("Issue not found");
  });

  it("failure at ensureFork stops the pipeline", async () => {
    const deps = createMockDeps();
    deps.gitHubClient.ensureFork.mockRejectedValue(new Error("Fork failed"));

    await expect(ingestIssue(deps, validUrl)).rejects.toThrow("Fork failed");

    expect(deps.gitOps.cloneRepo).not.toHaveBeenCalled();
  });

  it("failure at cloneRepo stops the pipeline", async () => {
    const deps = createMockDeps();
    deps.gitOps.cloneRepo.mockRejectedValue(new Error("Clone failed"));

    await expect(ingestIssue(deps, validUrl)).rejects.toThrow("Clone failed");

    expect(deps.gitOps.createBranch).not.toHaveBeenCalled();
  });

  it("failure at createBranch stops the pipeline", async () => {
    const deps = createMockDeps();
    deps.gitOps.createBranch.mockRejectedValue(new Error("Branch creation failed"));

    await expect(ingestIssue(deps, validUrl)).rejects.toThrow("Branch creation failed");
  });
});
