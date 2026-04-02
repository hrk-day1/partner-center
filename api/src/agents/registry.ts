import type { AgentResult, AgentType, Implementation, SubAgentConfig } from "./types.js";
import type { eventBus } from "./event-bus.js";

export interface Agent<TInput, TOutput> {
  readonly type: AgentType;
  run(
    input: TInput,
    bus: typeof eventBus,
    config: SubAgentConfig,
  ): Promise<AgentResult<TOutput>>;
}

type AgentFactory = new () => Agent<unknown, unknown>;

const registry = new Map<string, AgentFactory>();

function key(agentType: AgentType, impl: Implementation): string {
  return `${agentType}:${impl}`;
}

export function registerAgent(
  agentType: AgentType,
  impl: Implementation,
  factory: AgentFactory,
): void {
  registry.set(key(agentType, impl), factory);
}

export function getAgent<TInput, TOutput>(
  agentType: AgentType,
  impl: Implementation,
): Agent<TInput, TOutput> {
  const Factory = registry.get(key(agentType, impl));
  if (!Factory) {
    throw new Error(`Agent not found: ${agentType}/${impl}`);
  }
  return new Factory() as unknown as Agent<TInput, TOutput>;
}

export function listAgents(): { agentType: string; implementation: string }[] {
  return [...registry.keys()].map((k) => {
    const [agentType, implementation] = k.split(":");
    return { agentType, implementation };
  });
}
