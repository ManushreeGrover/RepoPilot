import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { searchRepository } from './repoSearch.js';
import { readFile } from './fileReader.js';
import type { RepoOverview } from './repoAnalyser.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Citation {
  file: string;
  line: number;
  snippet: string;
}

export interface AiAnswer {
  answer: string;
  citations: Citation[];
}

export interface AiEnhancement {
  frameworks: string[];
  entryPoints: Array<{ relativePath: string; description: string }>;
  routes: Array<{ method: string; path: string; file: string; line: number }>;
  runCommands: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILES_IN_CONTEXT = 8;
const MAX_FILE_CHARS = 6000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY is not set. Add it to backend/.env');
  }
  return new GoogleGenerativeAI(key);
}

function buildOverviewSummary(overview: RepoOverview): string {
  const langs = overview.languages.map(l => `${l.name} (${l.percentage}%)`).join(', ');
  const frameworks = overview.frameworks.join(', ') || 'none detected';
  const entries = overview.entryPoints.map(e => e.relativePath).join(', ') || 'none detected';
  const dirs = overview.directories.slice(0, 8).map(d => `${d.name}/ — ${d.description}`).join(', ');
  const routes = overview.apiRoutes
    .slice(0, 10)
    .map(r => `${r.method} ${r.path} (${r.file}:${r.line})`)
    .join('\n  ');

  return `
Project: ${overview.name}
Languages: ${langs}
Frameworks: ${frameworks}
Entry points: ${entries}
Top directories: ${dirs}
Total files: ${overview.totalFiles}
Has tests: ${overview.hasTests}
${routes ? `API routes (sample):\n  ${routes}` : ''}
`.trim();
}

function extractKeywords(question: string): string[] {
  const stopWords = new Set(['what', 'how', 'where', 'does', 'is', 'are', 'the', 'this', 'a', 'an',
    'do', 'it', 'in', 'of', 'to', 'and', 'or', 'project', 'code', 'file', 'files', 'can', 'i', 'me']);
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function tryReadFile(repoPath: string, relPath: string): string | null {
  try {
    const fc = readFile(repoPath, relPath, { maxLines: 300 });
    return fc.lines.map(l => l.content).join('\n').slice(0, MAX_FILE_CHARS);
  } catch {
    return null;
  }
}

async function gatherRelevantFiles(
  repoPath: string,
  overview: RepoOverview,
  question: string
): Promise<Array<{ relativePath: string; content: string }>> {
  const seen = new Set<string>();
  const candidates: string[] = [];

  function add(relPath: string) {
    if (!seen.has(relPath)) {
      seen.add(relPath);
      candidates.push(relPath);
    }
  }

  // 1. Always include README if present
  for (const name of ['README.md', 'readme.md']) {
    if (fs.existsSync(path.join(repoPath, name))) add(name);
  }

  // 2. Entry points
  for (const ep of overview.entryPoints.slice(0, 3)) add(ep.relativePath);

  // 3. Search using individual keywords extracted from the question
  const keywords = extractKeywords(question);
  for (const kw of keywords.slice(0, 5)) {
    const results = searchRepository(repoPath, kw, { maxResults: 10 });
    for (const r of results) {
      add(r.file);
      if (candidates.length >= MAX_FILES_IN_CONTEXT) break;
    }
    if (candidates.length >= MAX_FILES_IN_CONTEXT) break;
  }

  // 4. If question is route-related, include route source files
  const routeKeywords = ['route', 'endpoint', 'api', 'post', 'get', 'request', 'handler'];
  if (routeKeywords.some(k => question.toLowerCase().includes(k))) {
    for (const route of overview.apiRoutes.slice(0, 5)) add(route.file);
  }

  // 5. Fallback: if still empty, grab first source files from top directories
  if (candidates.length === 0) {
    for (const dir of overview.directories.slice(0, 2)) {
      const dirPath = path.join(repoPath, dir.name);
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile() && /\.(ts|js|py|java|go|rs)$/.test(e.name)) {
            add(path.join(dir.name, e.name).replace(/\\/g, '/'));
            if (candidates.length >= 4) break;
          }
        }
      } catch { /* skip */ }
      if (candidates.length >= 4) break;
    }
  }

  // Read each candidate
  const files: Array<{ relativePath: string; content: string }> = [];
  for (const relPath of candidates.slice(0, MAX_FILES_IN_CONTEXT)) {
    const content = tryReadFile(repoPath, relPath);
    if (content !== null) files.push({ relativePath: relPath, content });
  }

  return files;
}

function buildPrompt(
  question: string,
  overviewSummary: string,
  files: Array<{ relativePath: string; content: string }>
): string {
  const fileSections = files.length > 0
    ? files.map(f => `--- FILE: ${f.relativePath} ---\n${f.content}\n--- END FILE ---`).join('\n\n')
    : '(No file contents available — answer from the repository overview only)';

  return `You are RepoPilot, an AI assistant that helps developers understand codebases.

## Repository Overview
${overviewSummary}

## Relevant File Contents
${fileSections}

## Developer Question
${question}

## Instructions
- Answer clearly and concisely based on the repository overview and file contents above.
- At the end of your answer, list every specific file and line number you referenced. Use this exact format for each:
  CITATION: <relative/path/to/file>:<line_number> | <short snippet or reason>
- If the relevant files are not shown, say so and describe what you can infer from the project overview.
- Do not make up code or functionality that isn't shown.`;
}

function parseCitations(raw: string): { answer: string; citations: Citation[] } {
  const lines = raw.split('\n');
  const citationLines: string[] = [];
  const answerLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('CITATION:')) {
      citationLines.push(line);
    } else {
      answerLines.push(line);
    }
  }

  const citations: Citation[] = [];
  for (const cl of citationLines) {
    const match = cl.match(/CITATION:\s*([^:]+):(\d+)\s*\|\s*(.*)/);
    if (match) {
      citations.push({
        file: match[1].trim(),
        line: parseInt(match[2], 10),
        snippet: match[3].trim(),
      });
    }
  }

  return {
    answer: answerLines.join('\n').trim(),
    citations,
  };
}

// ─── Main exports ────────────────────────────────────────────────────────────

export async function askQuestion(
  repoPath: string,
  overview: RepoOverview,
  question: string
): Promise<AiAnswer> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'gemini-3.8-flash' });

  const overviewSummary = buildOverviewSummary(overview);
  const files = await gatherRelevantFiles(repoPath, overview, question);
  const prompt = buildPrompt(question, overviewSummary, files);

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  return parseCitations(raw);
}

// ─── AI Enhancement ───────────────────────────────────────────────────────────

function gatherEnhancementFiles(
  repoPath: string,
  overview: Pick<RepoOverview, 'directories' | 'languages'>
): Array<{ relativePath: string; content: string }> {
  const files: Array<{ relativePath: string; content: string }> = [];
  const seen = new Set<string>();

  function addFile(relPath: string) {
    if (seen.has(relPath)) return;
    const content = tryReadFile(repoPath, relPath);
    if (content !== null) {
      seen.add(relPath);
      files.push({ relativePath: relPath, content });
    }
  }

  // Config / dependency files — best signal for frameworks and run commands
  const CONFIG_NAMES = [
    'package.json', 'build.gradle', 'build.gradle.kts', 'pom.xml',
    'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml',
    'Gemfile', 'composer.json', 'mix.exs', 'build.sbt',
    'gradlew', 'Makefile',
  ];
  for (const name of CONFIG_NAMES) {
    const abs = path.join(repoPath, name);
    if (fs.existsSync(abs)) addFile(name);
  }

  // README
  for (const name of ['README.md', 'readme.md']) {
    if (fs.existsSync(path.join(repoPath, name))) addFile(name);
  }

  // Source files from main source directories — up to 2 levels deep
  const SOURCE_DIRS = ['src', 'app', 'lib', 'cmd', 'internal', 'pkg', 'main'];
  for (const dirName of SOURCE_DIRS) {
    const dirPath = path.join(repoPath, dirName);
    if (!fs.existsSync(dirPath)) continue;

    // Walk up to 5 levels for source files — Java packages go deep (src/main/java/com/example/...)
    function walkForSource(dir: string, depth: number) {
      if (depth > 5 || files.length >= 12) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }

      for (const entry of entries) {
        if (files.length >= 12) break;
        const abs = path.join(dir, entry.name);
        const rel = path.relative(repoPath, abs).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walkForSource(abs, depth + 1);
        } else if (entry.isFile() && /\.(ts|js|py|java|go|rs|rb|cs|kt|swift|php)$/.test(entry.name)) {
          addFile(rel);
        }
      }
    }

    walkForSource(dirPath, 0);
    if (files.length >= 12) break;
  }

  // Targeted scan: find likely entry point files by name anywhere in the tree
  const ENTRY_PATTERNS = /^(Application|Main|App|Server|Startup|Bootstrap)\.(java|kt|py|go|ts|js)$/i;
  function findEntryFiles(dir: string, depth: number) {
    if (depth > 8 || files.length >= 15) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (files.length >= 15) break;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(repoPath, abs).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        findEntryFiles(abs, depth + 1);
      } else if (entry.isFile() && ENTRY_PATTERNS.test(entry.name)) {
        addFile(rel);
      }
    }
  }
  findEntryFiles(repoPath, 0);

  return files;
}

export async function enhanceRepository(
  repoPath: string,
  overview: RepoOverview
): Promise<AiEnhancement> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: 'gemini-3.8-flash' });

  const files = gatherEnhancementFiles(repoPath, overview);
  const langs = overview.languages.map(l => l.name).join(', ');

  const fileSections = files.map(f =>
    `--- FILE: ${f.relativePath} ---\n${f.content}\n--- END FILE ---`
  ).join('\n\n');

  const prompt = `You are analysing a code repository to extract structural information.

Project name: ${overview.name}
Detected languages: ${langs}
Total files: ${overview.totalFiles}
Directories: ${overview.directories.map(d => d.name).join(', ')}

## File Contents
${fileSections}

## Task
Based on the files above, identify the following. Respond with ONLY valid JSON — no markdown, no explanation, just the JSON object.

{
  "frameworks": ["list of frameworks/libraries detected, e.g. Spring Boot, FastAPI, React, Django"],
  "entryPoints": [
    { "relativePath": "relative/path/to/file.java", "description": "short description e.g. Spring Boot main class" }
  ],
  "routes": [
    { "method": "GET", "path": "/api/example", "file": "relative/path/to/file", "line": 1 }
  ],
  "runCommands": ["./gradlew bootRun", "python main.py", "npm start"]
}

Rules:
- frameworks: detect from import statements, annotations, dependency files (package.json, build.gradle, requirements.txt, go.mod etc.)
- entryPoints: the file(s) that start the application — look for main(), @SpringBootApplication, if __name__ == "__main__", func main(), etc.
- routes: HTTP endpoints — look for @GetMapping, @PostMapping, @app.get(), router.get(), etc. Include only routes you can see in the provided files.
- runCommands: how to start this project — infer from scripts in package.json, gradlew, Makefile, README etc.
- If you cannot find something, return an empty array for that field.
- Return valid JSON only.`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  // Strip markdown code fences if Gemini wraps the JSON
  const jsonText = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(jsonText) as AiEnhancement;
    return {
      frameworks: Array.isArray(parsed.frameworks) ? parsed.frameworks : [],
      entryPoints: Array.isArray(parsed.entryPoints) ? parsed.entryPoints : [],
      routes: Array.isArray(parsed.routes) ? parsed.routes : [],
      runCommands: Array.isArray(parsed.runCommands) ? parsed.runCommands : [],
    };
  } catch {
    return { frameworks: [], entryPoints: [], routes: [], runCommands: [] };
  }
}
