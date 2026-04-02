import { EventEmitter } from "node:events";
import type { AgentEvent } from "./types.js";

class AgentEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit(pipelineId: string, event: AgentEvent): void {
    this.emitter.emit(pipelineId, event);
    this.emitter.emit("*", { pipelineId, ...event });
  }

  subscribe(
    pipelineId: string,
    callback: (event: AgentEvent) => void,
  ): () => void {
    this.emitter.on(pipelineId, callback);
    return () => this.emitter.off(pipelineId, callback);
  }

  subscribeAll(
    callback: (event: AgentEvent & { pipelineId: string }) => void,
  ): () => void {
    this.emitter.on("*", callback);
    return () => this.emitter.off("*", callback);
  }
}

export const eventBus = new AgentEventBus();
