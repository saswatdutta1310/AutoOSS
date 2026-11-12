import { AgentState } from "./state";

export class AgentGraph {
  async run(initialState: AgentState): Promise<AgentState> {
    // State graph execution cycle stub
    let currentState = { ...initialState };
    return currentState;
  }
}
