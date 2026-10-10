import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleAiRequest } from './src/server/aiHandler';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// API routes
app.use(async (req, res, next) => {
  const pathname = req.url.split('?')[0];
  if (pathname.startsWith('/api/ai/')) {
    const handled = await handleAiRequest(req, res, pathname, req.body);
    if (handled) return;
  }
  next();
});

// Serve frontend dist in production
const distDir = path.resolve(process.cwd(), 'dist');
app.use(express.static(distDir));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CogniNote AI server running on port ${PORT}`);
});
