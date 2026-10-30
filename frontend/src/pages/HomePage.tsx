import { useState } from 'react';
import type { RepoOverview, AiEnhancement } from '../types/index.js';
import { fetchOverview, fetchEnhancement } from '../api/repoApi.js';
import RepoOverviewComponent from '../components/RepoOverview.js';
import FileViewer from '../components/FileViewer.js';
import AiPanel from '../components/AiPanel.js';

interface Props {
  repoPath: string;
  overview: RepoOverview | null;
  onRepoLoaded: (path: string, overview: RepoOverview) => void;
}

export default function HomePage({ repoPath, overview, onRepoLoaded }: Props) {
  const [inputPath, setInputPath] = useState(repoPath);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<{ path: string; line?: number } | null>(null);
  const [enhancement, setEnhancement] = useState<AiEnhancement | null>(null);

  async function handleAnalyse(e: React.FormEvent) {
    e.preventDefault();
    const p = inputPath.trim();
    if (!p) return;
    setLoading(true);
    setError(null);
    setOpenFile(null);
    setEnhancement(null);
    try {
      const result = await fetchOverview(p);
      onRepoLoaded(p, result);

      // Run AI enhancement in background — don't block the overview from showing
      setEnhancing(true);
      fetchEnhancement(p)
        .then(e => setEnhancement(e))
        .catch(() => { /* silently skip if no API key or error */ })
        .finally(() => setEnhancing(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  // Merge AI enhancement into overview — AI results take priority if they found more
  const mergedOverview: RepoOverview | null = overview && enhancement ? {
    ...overview,
    frameworks: enhancement.frameworks.length > 0
      ? [...new Set([...enhancement.frameworks, ...overview.frameworks])]
      : overview.frameworks,
    entryPoints: enhancement.entryPoints.length > 0
      ? enhancement.entryPoints.map(ep => ({ relativePath: ep.relativePath, absolutePath: '' }))
      : overview.entryPoints,
    apiRoutes: enhancement.routes.length > 0 ? enhancement.routes : overview.apiRoutes,
    runCommands: enhancement.runCommands.length > 0 ? enhancement.runCommands : overview.runCommands,
  } : overview;

  return (
    <div className="page" style={{ flexDirection: 'row' }}>

      {/* ── Left column ────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Sticky form — always visible, never scrolls away */}
        <div className="home-form-bar">
          <form onSubmit={handleAnalyse} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720, width: '100%' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                placeholder="/Users/yourname/my-project"
                value={inputPath}
                onChange={e => setInputPath(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                disabled={loading || !inputPath.trim()}
              >
                {loading
                  ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analysing…</>
                  : 'Analyse'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Paste the full path to any local code project. No files are sent anywhere.
            </div>
          </form>
        </div>

        {/* Scrollable overview area */}
        <div className="home-scroll">
          <div className="home-content">
            {error && <div className="error-banner">{error}</div>}

            {!overview && !loading && !error && (
              <div className="empty-state" style={{ marginTop: 48 }}>
                <div style={{ fontSize: 40 }}>🗂</div>
                <h3>Enter a repository path above</h3>
                <span>RepoPilot will analyse languages, frameworks, entry points, API routes, and more.</span>
              </div>
            )}

            {overview && (
              <>
                <RepoOverviewComponent
                  overview={mergedOverview ?? overview}
                  onOpenFile={(f, l) => setOpenFile({ path: f, line: l })}
                />
                {enhancing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 12 }}>
                    <span className="spinner" style={{ width: 12, height: 12 }} />
                    AI enhancing frameworks, entry points &amp; routes…
                  </div>
                )}
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Ask AI</span>
                    <span className="badge badge-primary">Gemini</span>
                  </div>
                  <AiPanel repoPath={overview.rootPath} onOpenFile={(f, l) => setOpenFile({ path: f, line: l })} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel — slides in smoothly ───────────────────────── */}
      <div className={`file-panel ${openFile ? 'file-panel-open' : ''}`}>
        {openFile && overview && (
          <>
            <div className="file-panel-topbar">
              <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {openFile.path}
              </span>
              <button
                className="btn btn-ghost"
                style={{ padding: '3px 10px', fontSize: 12, flexShrink: 0 }}
                onClick={() => setOpenFile(null)}
              >
                ✕ Close
              </button>
            </div>
            <FileViewer
              repoPath={overview.rootPath}
              filePath={openFile.path}
              highlightLine={openFile.line}
            />
          </>
        )}
      </div>

    </div>
  );
}

