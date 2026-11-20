export type AgentEventType =
  | "phase_started"
  | "phase_finished"
  | "log"
  | "iteration"
  | "test_result"
  | "approval_needed"
  | "done";

export interface PhaseStartedPayload {
  phase: string;
  description?: string;
}

export interface PhaseFinishedPayload {
  phase: string;
  success: boolean;
  error?: string;
}

export interface LogPayload {
  level: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface IterationPayload {
  iteration: number;
  maxIterations?: number;
  summary?: string;
}

export interface TestResultPayload {
  passed: boolean;
  totalTests?: number;
  failedTests?: number;
  output?: string;
}

export interface ApprovalNeededPayload {
  action: string;
  description: string;
  diff?: string;
}

export interface DonePayload {
  success: boolean;
  summary: string;
}

export type AgentEventMap = {
  phase_started: PhaseStartedPayload;
  phase_finished: PhaseFinishedPayload;
  log: LogPayload;
  iteration: IterationPayload;
  test_result: TestResultPayload;
  approval_needed: ApprovalNeededPayload;
  done: DonePayload;
};

export type AgentEvent<T extends AgentEventType = AgentEventType> = {
  type: T;
  payload: AgentEventMap[T];
  timestamp: number;
};

export type EventHandler<T extends AgentEventType> = (payload: AgentEventMap[T]) => void;

export interface EventBus {
  emit<T extends AgentEventType>(event: T, payload: AgentEventMap[T]): void;
  on<T extends AgentEventType>(event: T, handler: EventHandler<T>): void;
  off<T extends AgentEventType>(event: T, handler: EventHandler<T>): void;
}

export function createEventBus(): EventBus {
  const listeners: { [K in AgentEventType]?: Set<EventHandler<any>> } = {};

  return {
    emit<T extends AgentEventType>(event: T, payload: AgentEventMap[T]): void {
      const handlers = listeners[event];
      if (handlers) {
        for (const handler of Array.from(handlers)) {
          handler(payload);
        }
      }
    },
    on<T extends AgentEventType>(event: T, handler: EventHandler<T>): void {
      if (!listeners[event]) {
        listeners[event] = new Set();
      }
      listeners[event]!.add(handler);
    },
    off<T extends AgentEventType>(event: T, handler: EventHandler<T>): void {
      const handlers = listeners[event];
      if (handlers) {
        handlers.delete(handler);
      }
    },
  };
}
