import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import 'highlight.js/styles/github-dark.css';

import type { FileContent } from '../types/index.js';
import { fetchFile } from '../api/repoApi.js';

// Register only languages we actually need (keeps bundle small)
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);

interface Props {
  repoPath: string;
  filePath: string;
  highlightLine?: number; // scroll to and highlight this line
  startLine?: number;
  endLine?: number;
}

export default function FileViewer({ repoPath, filePath, highlightLine, startLine, endLine }: Props) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!repoPath || !filePath) return;
    setLoading(true);
    setError(null);
    setContent(null);

    fetchFile(repoPath, filePath, { startLine, endLine })
      .then(setContent)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [repoPath, filePath, startLine, endLine]);

  // Scroll highlighted line into view
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [content, highlightLine]);

  if (loading) {
    return (
      <div className="file-viewer">
        <div className="empty-state"><div className="spinner" /><span>Loading…</span></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-viewer">
        <div style={{ padding: '16px' }}>
          <div className="error-banner">{error}</div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="file-viewer">
        <div className="empty-state">
          <h3>No file selected</h3>
          <span>Click a search result to open it here</span>
        </div>
      </div>
    );
  }

  // Highlight all lines at once then split — much more accurate than per-line
  const plainText = content.lines.map(l => l.content).join('\n');
  let highlighted: string;
  try {
    highlighted = hljs.highlight(plainText, { language: content.language }).value;
  } catch {
    highlighted = plainText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  const highlightedLines = highlighted.split('\n');

  const sizeKb = (content.sizeBytes / 1024).toFixed(1);

  return (
    <div className="file-viewer">
      <div className="file-header">
        <div className="file-path">
          <span>{content.relativePath}</span>
        </div>
        <div className="file-meta">
          {content.language} · {content.totalLines} lines · {sizeKb} KB
          {content.isTruncated && ' · (showing first 500 lines)'}
        </div>
      </div>

      <div className="code-scroll">
        <table className="code-table">
          <tbody>
            {content.lines.map((line, idx) => {
              const isHL = line.number === highlightLine;
              return (
                <tr
                  key={line.number}
                  ref={isHL ? highlightRef : undefined}
                  className={isHL ? 'highlight-line' : undefined}
                >
                  <td className="line-number">{line.number}</td>
                  <td
                    className="line-content hljs"
                    dangerouslySetInnerHTML={{ __html: highlightedLines[idx] ?? '' }}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
