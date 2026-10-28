import { useState } from 'react';
import type { SearchMatch, SearchResult } from '../types/index.js';
import { fetchSearch } from '../api/repoApi.js';

interface Props {
  repoPath: string;
  onSelect: (match: SearchMatch) => void;
}

function highlightMatch(content: string, query: string) {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{content}</span>;
  return (
    <>
      {content.slice(0, idx)}
      <mark>{content.slice(idx, idx + query.length)}</mark>
      {content.slice(idx + query.length)}
    </>
  );
}

export default function SearchPanel({ repoPath, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [filePattern, setFilePattern] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(match: SearchMatch, idx: number) {
    setSelected(idx);
    onSelect(match);
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const res = await fetchSearch(repoPath, query.trim(), {
        filePattern: filePattern.trim() || undefined,
        maxResults: 100,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Search bar */}
      <form className="explore-top" onSubmit={runSearch}>
        <input
          className="input"
          style={{ maxWidth: 360 }}
          placeholder="Search in repository…  e.g. authentication"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <input
          className="input"
          style={{ width: 120 }}
          placeholder="*.ts"
          title="File filter (e.g. *.ts)"
          value={filePattern}
          onChange={e => setFilePattern(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Search'}
        </button>
      </form>

      {/* Results */}
      <div className="results-panel">
        {error && (
          <div style={{ padding: 12 }}>
            <div className="error-banner">{error}</div>
          </div>
        )}

        {!result && !error && !loading && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <h3>Search the codebase</h3>
            <span>Find functions, routes, patterns, or keywords</span>
          </div>
        )}

        {result && (
          <>
            <div className="results-header">
              {result.total === 0
                ? `No results for "${result.query}"`
                : `${result.total} match${result.total === 1 ? '' : 'es'} for "${result.query}"`}
              {result.total >= 100 && <span style={{ marginLeft: 6, color: 'var(--warning)' }}>(capped at 100)</span>}
            </div>
            <div className="results-list">
              {result.results.map((match, idx) => (
                <button
                  key={idx}
                  className={`result-item ${selected === idx ? 'selected' : ''}`}
                  onClick={() => handleSelect(match, idx)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
                >
                  <div className="result-file">
                    {match.file}
                    <span className="result-line-ref">:{match.line}</span>
                  </div>
                  <div className="result-content">
                    {highlightMatch(match.content, result.query)}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
