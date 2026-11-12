import { EventEmitter } from "events";

export type EventPayload = {
  phase: string;
  status: "idle" | "in-progress" | "success" | "error";
  data?: unknown;
};

export const eventBus = new EventEmitter();

export function emitPhaseChange(phase: string, status: EventPayload["status"], data?: unknown): void {
  eventBus.emit("phase", { phase, status, data });
}
