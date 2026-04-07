import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { pipelineRouter } from './routes/pipeline.js';
import { setupAgents } from './agents/setup.js';

setupAgents();

if (!env.geminiApiKey) {
  console.warn('[api] WARNING: GEMINI_API_KEY is not set. LLM agents will fail. Set it in .env file.');
}

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/pipeline', pipelineRouter);

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
