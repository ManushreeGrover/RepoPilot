import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { AiAnswer, Citation } from '../types/index.js';
import { askQuestion } from '../api/repoApi.js';

interface Props {
  repoPath: string;
  onOpenFile: (file: string, line?: number) => void;
}

const SUGGESTIONS = [
  'What does this project do?',
  'How is authentication handled?',
  'Where is the database connected?',
  'What are the main API endpoints?',
  'How do I run this project?',
];

export default function AiPanel({ repoPath, onOpenFile }: Props) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ question: string; answer: AiAnswer }>>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await askQuestion(repoPath, q);
      setHistory(prev => [{ question: q, answer: result }, ...prev]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Input + suggestions */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <form onSubmit={handleAsk} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            placeholder="Ask anything about this codebase…"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={loading}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            disabled={loading || !question.trim()}
          >
            {loading
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Thinking…</>
              : 'Ask'}
          </button>
        </form>

        {/* Suggestion chips — always visible */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              className="btn btn-ghost"
              style={{ padding: '3px 10px', fontSize: 11 }}
              onClick={() => setQuestion(s)}
              disabled={loading}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Answers */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && <div className="error-banner">{error}</div>}

        {history.length === 0 && !loading && !error && (
          <div className="empty-state" style={{ padding: '32px 20px' }}>
            <div style={{ fontSize: 32 }}>🤖</div>
            <h3>Ask Gemini about this codebase</h3>
            <span>Get answers with direct links to the relevant source files.</span>
          </div>
        )}

        {history.map((item, i) => (
          <AnswerCard
            key={i}
            question={item.question}
            answer={item.answer}
            onOpenFile={onOpenFile}
            dimmed={i > 0}
          />
        ))}
      </div>
    </div>
  );
}

function AnswerCard({
  question,
  answer,
  onOpenFile,
  dimmed = false,
}: {
  question: string;
  answer: AiAnswer;
  onOpenFile: (file: string, line?: number) => void;
  dimmed?: boolean;
}) {
  return (
    <div className="card" style={{ opacity: dimmed ? 0.55 : 1 }}>
      {/* Question */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--primary)',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        {question}
      </div>

      {/* Answer — rendered as markdown */}
      <div className="ai-answer">
        <ReactMarkdown>{answer.answer}</ReactMarkdown>
      </div>

      {/* Citations */}
      {answer.citations.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="overview-section-title" style={{ marginBottom: 8 }}>Sources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {answer.citations.map((c: Citation, i: number) => (
              <button
                key={i}
                onClick={() => onOpenFile(c.file, c.line)}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '5px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--primary)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  {c.file}:{c.line}
                </span>
                <span style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {c.snippet}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
