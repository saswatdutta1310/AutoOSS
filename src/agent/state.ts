export interface AgentState {
  issueUrl: string;
  issueDescription: string;
  relevantFiles: string[];
  proposedDiff: string;
  testOutput: string;
  isResolved: boolean;
  iteration: number;
}

export function createInitialState(issueUrl: string): AgentState {
  return {
    issueUrl,
    issueDescription: "",
    relevantFiles: [],
    proposedDiff: "",
    testOutput: "",
    isResolved: false,
    iteration: 0,
  };
}
