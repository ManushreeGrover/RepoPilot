# RepoPilot — AI Codebase Onboarding Agent

## What this does
RepoPilot analyses a local code repository and helps developers understand it through interactive exploration, code search, and file inspection.

## Prerequisites
- Node.js 18 or later  (`node --version` to check)
- npm

## Setup

### 1. Install backend dependencies
```bash
cd backend
npm install
```

### 2. Install frontend dependencies
```bash
cd frontend
npm install
```

### 3. Run the backend (in one terminal)
```bash
cd backend
npm run dev
```
The API server starts at http://localhost:3001

### 4. Run the frontend (in another terminal)
```bash
cd frontend
npm run dev
```
Open http://localhost:5173 in your browser.

## Running tests
```bash
cd backend
npm test
```

## Try it with a sample repo
1. Open http://localhost:5173
2. In the path field, enter the absolute path to any local code project, for example:  
   `/Users/yourname/some-project`
3. Click "Analyse Repository"
4. Use the Explore tab to search for terms inside the repo

## Project structure
```
backend/
  src/
    services/     — repository analysis, search, file reading
    routes/       — Express API endpoints
    utils/        — path safety helpers
  tests/          — Vitest unit tests

frontend/
  src/
    api/          — typed fetch wrappers for the backend
    components/   — reusable UI pieces
    pages/        — full page views
    types/        — shared TypeScript types
```

## API endpoints (Milestone 1)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/repo/overview?path=... | Analyse a repository |
| GET | /api/repo/search?path=...&q=... | Search inside a repository |
| GET | /api/repo/file?path=...&file=...&startLine=...&endLine=... | Read a source file |
| GET | /api/health | Server health check |

## Milestones
- [x] Milestone 1 — Foundation: repository analysis, search, file viewer
- [ ] Milestone 2 — AI exploration (Gemini integration, tool calling)
- [ ] Milestone 3 — Execution-flow tracing
- [ ] Milestone 4 — Personalised onboarding plan
- [ ] Milestone 5 — Progress tracking and polish
