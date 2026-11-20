import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "../src/events.js";

describe("events", () => {
  it("emits events to registered subscribers", () => {
    const bus = createEventBus();
    const mockHandler = vi.fn();

    bus.on("phase_started", mockHandler);
    bus.emit("phase_started", { phase: "planning", description: "Planning fixes" });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith({
      phase: "planning",
      description: "Planning fixes",
    });
  });

  it("handles unsubscription via off()", () => {
    const bus = createEventBus();
    const mockHandler = vi.fn();

    bus.on("log", mockHandler);
    bus.emit("log", { level: "info", message: "first log" });

    bus.off("log", mockHandler);
    bus.emit("log", { level: "warn", message: "second log" });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith({
      level: "info",
      message: "first log",
    });
  });

  it("supports multiple listeners for the same event", () => {
    const bus = createEventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.on("done", handler1);
    bus.on("done", handler2);

    bus.emit("done", { success: true, summary: "All done" });

    expect(handler1).toHaveBeenCalledWith({ success: true, summary: "All done" });
    expect(handler2).toHaveBeenCalledWith({ success: true, summary: "All done" });
  });

  it("handles events with no registered listeners gracefully", () => {
    const bus = createEventBus();
    expect(() => {
      bus.emit("test_result", { passed: true });
    }).not.toThrow();
  });
});
