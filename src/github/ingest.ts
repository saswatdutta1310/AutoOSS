import { AgentEventType, AgentEventMap } from "../events.js";
import { makeBranchName } from "./branchName.js";
import { GitHubClient, Issue } from "./client.js";
import { GitOps } from "./git.js";
import { parseIssueUrl } from "./issueParser.js";
import { createRunDir } from "./workspace.js";

export type EventEmitterFn = <T extends AgentEventType>(event: T, payload: AgentEventMap[T]) => void;

export interface IngestDependencies {
  gitHubClient: GitHubClient;
  gitOps: GitOps;
  createRunDir?: (owner: string, repo: string, issueNumber: number) => Promise<string>;
  makeBranchName?: (issueNumber: number, title: string) => string;
}

export interface IngestResult {
  issue: Issue;
  contributing: string | null;
  repoPath: string;
  branch: string;
  forkOwner: string;
  forkRepo: string;
}

export async function ingestIssue(
  deps: IngestDependencies,
  issueUrl: string,
  emit?: EventEmitterFn
): Promise<IngestResult> {
  const safeEmit: EventEmitterFn = (event, payload) => {
    if (emit) {
      try {
        emit(event, payload);
      } catch {
        // Logging/emit failure must not crash pipeline
      }
    }
  };

  safeEmit("phase_started", { phase: "ingest", description: "Starting issue ingestion" });

  try {
    // 1. Parse URL
    safeEmit("log", { level: "info", message: `Parsing issue URL: ${issueUrl}` });
    const ref = parseIssueUrl(issueUrl);

    // 2. Viewer Login
    safeEmit("log", { level: "info", message: "Fetching GitHub viewer login" });
    await deps.gitHubClient.getViewerLogin();

    // 3. Get Issue
    safeEmit("log", { level: "info", message: `Fetching issue #${ref.number} from ${ref.owner}/${ref.repo}` });
    const issue = await deps.gitHubClient.getIssue(ref);

    // 4. Get CONTRIBUTING.md (null is fine)
    safeEmit("log", { level: "info", message: "Checking for CONTRIBUTING.md" });
    let contributing: string | null = null;
    try {
      contributing = await deps.gitHubClient.getFileContent(ref.owner, ref.repo, "CONTRIBUTING.md");
      if (!contributing) {
        contributing = await deps.gitHubClient.getFileContent(ref.owner, ref.repo, ".github/CONTRIBUTING.md");
      }
    } catch {
      contributing = null;
    }

    // 5. Ensure Fork
    safeEmit("log", { level: "info", message: `Ensuring repository fork for ${ref.owner}/${ref.repo}` });
    const fork = await deps.gitHubClient.ensureFork(ref.owner, ref.repo);

    // 6. Create Run Dir
    safeEmit("log", { level: "info", message: "Creating local run directory" });
    const runDirFn = deps.createRunDir ?? createRunDir;
    const repoPath = await runDirFn(ref.owner, ref.repo, ref.number);

    // 7. Clone Repo
    safeEmit("log", { level: "info", message: `Cloning fork repository into ${repoPath}` });
    await deps.gitOps.cloneRepo(fork.cloneUrl, repoPath);

    // 8. Create Branch
    const branchFn = deps.makeBranchName ?? makeBranchName;
    const branch = branchFn(ref.number, issue.title);
    safeEmit("log", { level: "info", message: `Creating and checking out working branch ${branch}` });
    await deps.gitOps.createBranch(repoPath, branch);

    safeEmit("phase_finished", { phase: "ingest", success: true });

    return {
      issue,
      contributing,
      repoPath,
      branch,
      forkOwner: fork.owner,
      forkRepo: fork.repo,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    safeEmit("phase_finished", { phase: "ingest", success: false, error: errorMsg });
    safeEmit("log", { level: "error", message: `Issue ingestion failed: ${errorMsg}` });
    throw err;
  }
}
