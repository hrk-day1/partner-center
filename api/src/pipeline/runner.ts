import type { PipelineConfig, PipelineResult } from '../types/pipeline.js';
import { orchestrate } from '../agents/orchestrator.js';

export async function runPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const { pipelineId: _, ...result } = await orchestrate(config);
  return result;
}
