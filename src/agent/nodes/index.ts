import { AgentState } from "../state";

export async function locateFilesNode(state: AgentState): Promise<Partial<AgentState>> {
  return { relevantFiles: [] };
}

export async function generatePatchNode(state: AgentState): Promise<Partial<AgentState>> {
  return { proposedDiff: "" };
}

export async function testPatchNode(state: AgentState): Promise<Partial<AgentState>> {
  return { testOutput: "", isResolved: true };
}
