import express from 'express';
import cors from 'cors';
import repoRouter from './routes/repo.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'], // Vite dev + preview
  methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(express.json({ limit: '1mb' }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', milestone: 1 });
});

app.use('/api/repo', repoRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`RepoPilot backend running at http://localhost:${PORT}`);
});
