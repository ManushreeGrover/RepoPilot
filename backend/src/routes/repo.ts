import { Router, Request, Response } from 'express';
import { analyseRepository } from '../services/repoAnalyser.js';
import { searchRepository } from '../services/repoSearch.js';
import { readFile } from '../services/fileReader.js';

const router = Router();

// ─── GET /api/repo/overview ───────────────────────────────────────────────────
// Query params: path (required) — absolute path to the repository
router.get('/overview', (req: Request, res: Response) => {
  const repoPath = req.query.path as string | undefined;

  if (!repoPath || repoPath.trim() === '') {
    res.status(400).json({ error: 'Query parameter "path" is required' });
    return;
  }

  try {
    const overview = analyseRepository(repoPath.trim());
    res.json(overview);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

// ─── GET /api/repo/search ─────────────────────────────────────────────────────
// Query params: path, q, caseSensitive?, maxResults?, filePattern?
router.get('/search', (req: Request, res: Response) => {
  const repoPath = req.query.path as string | undefined;
  const query = req.query.q as string | undefined;

  if (!repoPath || repoPath.trim() === '') {
    res.status(400).json({ error: 'Query parameter "path" is required' });
    return;
  }
  if (!query || query.trim() === '') {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  const caseSensitive = req.query.caseSensitive === 'true';
  const maxResults = parseInt(req.query.maxResults as string ?? '100', 10) || 100;
  const filePattern = req.query.filePattern as string | undefined;

  try {
    const results = searchRepository(repoPath.trim(), query.trim(), {
      caseSensitive,
      maxResults: Math.min(maxResults, 200), // hard cap at 200
      filePattern,
    });
    res.json({ query, results, total: results.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

// ─── GET /api/repo/file ───────────────────────────────────────────────────────
// Query params: path (repo root), file (relative path), startLine?, endLine?
router.get('/file', (req: Request, res: Response) => {
  const repoPath = req.query.path as string | undefined;
  const filePath = req.query.file as string | undefined;

  if (!repoPath || repoPath.trim() === '') {
    res.status(400).json({ error: 'Query parameter "path" is required' });
    return;
  }
  if (!filePath || filePath.trim() === '') {
    res.status(400).json({ error: 'Query parameter "file" is required' });
    return;
  }

  const startLine = req.query.startLine ? parseInt(req.query.startLine as string, 10) : undefined;
  const endLine = req.query.endLine ? parseInt(req.query.endLine as string, 10) : undefined;

  try {
    const content = readFile(repoPath.trim(), filePath.trim(), { startLine, endLine });
    res.json(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('Security') ? 403 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;
