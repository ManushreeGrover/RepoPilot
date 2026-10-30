import type { RepoOverview, SearchResult, FileContent, AiAnswer, AiEnhancement } from '../types/index.js';

const BASE = '/api';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchOverview(repoPath: string): Promise<RepoOverview> {
  return get<RepoOverview>(`${BASE}/repo/overview?path=${encodeURIComponent(repoPath)}`);
}

export async function fetchSearch(
  repoPath: string,
  query: string,
  options?: { caseSensitive?: boolean; maxResults?: number; filePattern?: string }
): Promise<SearchResult> {
  const params = new URLSearchParams({ path: repoPath, q: query });
  if (options?.caseSensitive) params.set('caseSensitive', 'true');
  if (options?.maxResults) params.set('maxResults', String(options.maxResults));
  if (options?.filePattern) params.set('filePattern', options.filePattern);
  return get<SearchResult>(`${BASE}/repo/search?${params.toString()}`);
}

export async function fetchFile(
  repoPath: string,
  filePath: string,
  options?: { startLine?: number; endLine?: number }
): Promise<FileContent> {
  const params = new URLSearchParams({ path: repoPath, file: filePath });
  if (options?.startLine) params.set('startLine', String(options.startLine));
  if (options?.endLine) params.set('endLine', String(options.endLine));
  return get<FileContent>(`${BASE}/repo/file?${params.toString()}`);
}

export async function askQuestion(repoPath: string, question: string): Promise<AiAnswer> {
  const res = await fetch(`${BASE}/ai/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath, question }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `AI request failed: ${res.status}`);
  }
  return res.json() as Promise<AiAnswer>;
}

export async function fetchEnhancement(repoPath: string): Promise<AiEnhancement> {
  const res = await fetch(`${BASE}/ai/enhance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Enhancement failed: ${res.status}`);
  }
  return res.json() as Promise<AiEnhancement>;
}
