import { Router } from 'express';
import type { Request, Response } from 'express';
import { analyseRepository } from '../services/repoAnalyser.js';
import { askQuestion, enhanceRepository } from '../services/aiService.js';

const router = Router();

// POST /api/ai/ask
router.post('/ask', async (req: Request, res: Response) => {
  const { repoPath, question } = req.body as { repoPath?: string; question?: string };

  if (!repoPath || typeof repoPath !== 'string') {
    res.status(400).json({ error: 'repoPath is required' });
    return;
  }
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  try {
    const overview = analyseRepository(repoPath);
    const answer = await askQuestion(repoPath, overview, question.trim());
    res.json(answer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

// POST /api/ai/enhance
// Runs after Analyse — Gemini identifies frameworks, entry points, routes for any language
router.post('/enhance', async (req: Request, res: Response) => {
  const { repoPath } = req.body as { repoPath?: string };

  if (!repoPath || typeof repoPath !== 'string') {
    res.status(400).json({ error: 'repoPath is required' });
    return;
  }

  try {
    const overview = analyseRepository(repoPath);
    const enhancement = await enhanceRepository(repoPath, overview);
    res.json(enhancement);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enhancement failed';
    const status = message.includes('GEMINI_API_KEY') ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
