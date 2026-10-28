import { useState } from 'react';
import type { SearchMatch } from '../types/index.js';
import SearchPanel from '../components/SearchPanel.js';
import FileViewer from '../components/FileViewer.js';

interface Props {
  repoPath: string;
  onGoHome: () => void;
}

export default function ExplorePage({ repoPath, onGoHome }: Props) {
  const [openFile, setOpenFile] = useState<{ path: string; line: number } | null>(null);

  function handleSelect(match: SearchMatch) {
    setOpenFile({ path: match.file, line: match.line });
  }

  if (!repoPath) {
    return (
      <div className="page">
        <div className="explore-no-repo">
          <div style={{ fontSize: 36 }}>🔍</div>
          <h3 style={{ color: 'var(--text-muted)' }}>No repository loaded</h3>
          <button className="btn btn-ghost" onClick={onGoHome}>Go to Overview →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="explore-body">
        {/* Left column: search bar + results list */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 340, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
          <SearchPanel repoPath={repoPath} onSelect={handleSelect} />
        </div>

        {/* Right column: file viewer */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <FileViewer
            repoPath={repoPath}
            filePath={openFile?.path ?? ''}
            highlightLine={openFile?.line}
          />
        </div>
      </div>
    </div>
  );
}
