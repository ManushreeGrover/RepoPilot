import type { RepoOverview } from '../types/index.js';

// Colour palette for the language bar — cycles through these
const LANG_COLOURS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899',
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
];

const METHOD_BADGE: Record<string, string> = {
  GET: 'badge-method-get',
  POST: 'badge-method-post',
  PUT: 'badge-method-put',
  PATCH: 'badge-method-patch',
  DELETE: 'badge-method-delete',
};

interface Props {
  overview: RepoOverview;
  onOpenFile: (file: string, line?: number) => void;
}

export default function RepoOverview({ overview, onOpenFile }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Project header */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{overview.name}</h2>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
            {overview.rootPath}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="badge badge-default">{overview.totalFiles} files</span>
          {overview.packageManager && (
            <span className="badge badge-primary">{overview.packageManager}</span>
          )}
          {overview.hasTests && (
            <span className="badge badge-success">tests ✓</span>
          )}
        </div>
      </div>

      <div className="overview-grid">
        {/* Languages */}
        <div className="card">
          <div className="overview-section-title">Languages</div>
          <div className="lang-bar">
            {overview.languages.map((lang, i) => (
              <div
                key={lang.name}
                style={{ width: `${lang.percentage}%`, background: LANG_COLOURS[i % LANG_COLOURS.length] }}
                title={`${lang.name} ${lang.percentage}%`}
              />
            ))}
          </div>
          {overview.languages.map((lang, i) => (
            <div key={lang.name} className="lang-item">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: LANG_COLOURS[i % LANG_COLOURS.length],
                  display: 'inline-block',
                }} />
                {lang.name}
              </span>
              <span style={{ color: 'var(--text-dim)' }}>{lang.fileCount} ({lang.percentage}%)</span>
            </div>
          ))}
        </div>

        {/* Frameworks */}
        <div className="card">
          <div className="overview-section-title">Frameworks & Tools</div>
          {overview.frameworks.length === 0 ? (
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>None detected</span>
          ) : (
            <div className="framework-list">
              {overview.frameworks.map(f => (
                <span key={f} className="badge badge-default">{f}</span>
              ))}
            </div>
          )}

          {overview.runCommands.length > 0 && (
            <>
              <div className="overview-section-title" style={{ marginTop: 14 }}>Run Commands</div>
              <div className="run-commands">
                {overview.runCommands.map(cmd => (
                  <code key={cmd} className="run-cmd">$ {cmd}</code>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Entry points */}
        <div className="card">
          <div className="overview-section-title">Entry Points</div>
          {overview.entryPoints.length === 0 ? (
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>None detected</span>
          ) : (
            overview.entryPoints.map(ep => (
              <button
                key={ep.relativePath}
                className="file-link"
                onClick={() => onOpenFile(ep.relativePath)}
                style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
              >
                {ep.relativePath}
              </button>
            ))
          )}

          <div className="overview-section-title" style={{ marginTop: 14 }}>Config Files</div>
          {overview.configFiles.slice(0, 8).map(cf => (
            <button
              key={cf.relativePath}
              className="file-link"
              onClick={() => onOpenFile(cf.relativePath)}
              style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
            >
              {cf.relativePath}
            </button>
          ))}
        </div>

        {/* Directories */}
        <div className="card">
          <div className="overview-section-title">Directory Structure</div>
          {overview.directories.slice(0, 10).map(dir => (
            <div key={dir.name} className="dir-row">
              <span className="dir-name">/{dir.name}</span>
              <span className="dir-desc">{dir.description}</span>
              <span className="dir-count">{dir.fileCount} files</span>
            </div>
          ))}
        </div>
      </div>

      {/* API routes */}
      {overview.apiRoutes.length > 0 && (
        <div className="card">
          <div className="overview-section-title">Detected API Routes ({overview.apiRoutes.length})</div>
          {overview.apiRoutes.slice(0, 20).map((route, i) => (
            <div key={i} className="route-row">
              <div className="route-row-top">
                <span className={`badge ${METHOD_BADGE[route.method] ?? 'badge-default'}`}>
                  {route.method}
                </span>
                <span className="route-path">{route.path}</span>
              </div>
              <button
                className="route-file"
                onClick={() => onOpenFile(route.file, route.line)}
              >
                {route.file}:{route.line}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Test locations */}
      {overview.testLocations.length > 0 && (
        <div className="card">
          <div className="overview-section-title">Test Locations</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {overview.testLocations.map(t => (
              <span key={t} className="badge badge-success">{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* README preview */}
      {overview.readmePreview && (
        <div className="card">
          <div className="overview-section-title">README Preview</div>
          <pre className="readme-preview">{overview.readmePreview}</pre>
        </div>
      )}
    </div>
  );
}
