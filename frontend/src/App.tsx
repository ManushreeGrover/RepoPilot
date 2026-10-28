import { useState } from 'react';
import type { RepoOverview } from './types/index.js';
import HomePage from './pages/HomePage.js';
import ExplorePage from './pages/ExplorePage.js';

type Tab = 'overview' | 'explore';

export default function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [repoPath, setRepoPath] = useState('');
  const [overview, setOverview] = useState<RepoOverview | null>(null);

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          Repo<span>Pilot</span>
        </div>
        {repoPath && (
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
            {repoPath}
          </div>
        )}
        <nav className="header-nav">
          <button
            className={`nav-btn ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            className={`nav-btn ${tab === 'explore' ? 'active' : ''}`}
            onClick={() => setTab('explore')}
            disabled={!overview}
            title={!overview ? 'Analyse a repository first' : undefined}
          >
            Explore
          </button>
        </nav>
      </header>

      {/* Both pages stay mounted — CSS hides the inactive one so state is preserved */}
      <div style={{ display: tab === 'overview' ? 'contents' : 'none' }}>
        <HomePage
          repoPath={repoPath}
          overview={overview}
          onRepoLoaded={(p, o) => { setRepoPath(p); setOverview(o); }}
        />
      </div>
      <div style={{ display: tab === 'explore' ? 'contents' : 'none' }}>
        <ExplorePage repoPath={repoPath} onGoHome={() => setTab('overview')} />
      </div>
    </div>
  );
}
