import { useState, useEffect } from 'react';

export default function CommentsPanel({ yComments, currentUser, onJumpToLine }) {
  const [comments, setComments] = useState([]);
  const [filter, setFilter]     = useState('open'); // 'open' | 'resolved'

  useEffect(() => {
    if (!yComments) return;
    const update = () => setComments(yComments.toArray());
    update();
    yComments.observe(update);
    return () => yComments.unobserve(update);
  }, [yComments]);

  const resolve = (id) => {
    if (!yComments) return;
    const idx = yComments.toArray().findIndex((c) => c.id === id);
    if (idx === -1) return;
    const updated = { ...yComments.get(idx), resolved: true };
    yComments.delete(idx, 1);
    yComments.insert(idx, [updated]);
  };

  const remove = (id) => {
    if (!yComments) return;
    const idx = yComments.toArray().findIndex((c) => c.id === id);
    if (idx !== -1) yComments.delete(idx, 1);
  };

  const visible = comments.filter((c) =>
    filter === 'resolved' ? c.resolved : !c.resolved,
  );

  const fmt = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="comments-panel">
      <div className="comments-filter">
        <button
          className={`comments-filter-btn ${filter === 'open' ? 'active' : ''}`}
          onClick={() => setFilter('open')}
        >
          Open ({comments.filter((c) => !c.resolved).length})
        </button>
        <button
          className={`comments-filter-btn ${filter === 'resolved' ? 'active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          Resolved ({comments.filter((c) => c.resolved).length})
        </button>
      </div>

      <div className="comments-list">
        {visible.length === 0 && (
          <div className="comments-empty">
            {filter === 'open'
              ? 'No open comments. Click a line number to add one.'
              : 'No resolved comments.'}
          </div>
        )}

        {visible.map((c) => (
          <div key={c.id} className={`comment-card ${c.resolved ? 'resolved' : ''}`}>
            <div className="comment-card-header">
              <div className="comment-card-meta">
                <span className="comment-dot" style={{ background: c.color }} />
                <span className="comment-author" style={{ color: c.color }}>{c.author}</span>
                <button
                  className="comment-line-btn"
                  onClick={() => onJumpToLine?.(c.line)}
                  title="Go to line"
                >
                  Ln {c.line}
                </button>
                <span className="comment-time">{fmt(c.ts)}</span>
              </div>
              <div className="comment-card-actions">
                {!c.resolved && c.author === currentUser?.username && (
                  <button
                    className="comment-action-btn"
                    onClick={() => resolve(c.id)}
                    title="Mark resolved"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </button>
                )}
                {c.author === currentUser?.username && (
                  <button
                    className="comment-action-btn danger"
                    onClick={() => remove(c.id)}
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="comment-card-text">{c.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
