import { registerAgent } from "./registry.js";
import { DeterministicPlanAgent } from "./deterministic-plan-agent.js";
import { LlmPlanAgent } from "./llm-plan-agent.js";
import { DeterministicGeneratorAgent } from "./deterministic-generator-agent.js";
import { LlmGeneratorAgent } from "./llm-generator-agent.js";
import { DeterministicEvaluatorAgent } from "./deterministic-evaluator-agent.js";
import { LlmEvaluatorAgent } from "./llm-evaluator-agent.js";

export function setupAgents(): void {
  registerAgent("plan", "deterministic", DeterministicPlanAgent as never);
  registerAgent("plan", "llm", LlmPlanAgent as never);
  registerAgent("generator", "deterministic", DeterministicGeneratorAgent as never);
  registerAgent("generator", "llm", LlmGeneratorAgent as never);
  registerAgent("evaluator", "deterministic", DeterministicEvaluatorAgent as never);
  registerAgent("evaluator", "llm", LlmEvaluatorAgent as never);

  console.log("[agents] 6 agents registered (3 deterministic + 3 llm)");
}
