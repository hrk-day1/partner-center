import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { pipelineRouter } from './routes/pipeline.js';
import { setupAgents } from './agents/setup.js';

setupAgents();

if (!env.geminiApiKey) {
  console.warn('[api] WARNING: GEMINI_API_KEY is not set. LLM agents will fail. Set it in .env file.');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const waterbeanDist = path.resolve(__dirname, '../../waterbean/dist');
const waterbeanIndex = path.join(waterbeanDist, 'index.html');
const serveWaterbean = fs.existsSync(waterbeanIndex);

if (!serveWaterbean) {
  console.warn(
    '[api] waterbean/dist not found — API only (build waterbean for production UI on this server).',
  );
}

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const apiRouter = express.Router();
apiRouter.use('/pipeline', pipelineRouter);
app.use('/api', apiRouter);

app.use('/pipeline', pipelineRouter);

if (serveWaterbean) {
  app.use(express.static(waterbeanDist));
  // Express 5 / path-to-regexp: bare '*' is invalid; use middleware after static fallthrough.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(waterbeanIndex, (err) => next(err));
  });
}

app.listen(env.port, () => {
  console.log(`[api] listening on http://localhost:${env.port}`);
});
