import type { AgentState, PipelineExecution } from "./types.js";

const TTL_MS = 30 * 60 * 1000;

const executions = new Map<string, PipelineExecution>();

export function createExecution(
  pipelineId: string,
  config: Record<string, unknown>,
): PipelineExecution {
  const execution: PipelineExecution = {
    pipelineId,
    config,
    agents: [],
    startedAt: new Date().toISOString(),
  };
  executions.set(pipelineId, execution);
  return execution;
}

export function getExecution(pipelineId: string): PipelineExecution | undefined {
  return executions.get(pipelineId);
}

export function updateAgentState(
  pipelineId: string,
  state: AgentState,
): void {
  const exec = executions.get(pipelineId);
  if (!exec) return;

  const idx = exec.agents.findIndex((a) => a.agentId === state.agentId);
  if (idx >= 0) {
    exec.agents[idx] = state;
  } else {
    exec.agents.push(state);
  }
}

export function completeExecution(
  pipelineId: string,
  result: unknown,
): void {
  const exec = executions.get(pipelineId);
  if (!exec) return;
  exec.result = result;
  exec.completedAt = new Date().toISOString();

  setTimeout(() => executions.delete(pipelineId), TTL_MS);
}

export function listExecutions(): PipelineExecution[] {
  return [...executions.values()];
}
