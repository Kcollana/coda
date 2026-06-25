import { useState, useEffect, useRef } from 'react';

export default function CommentPopover({ line, yComments, currentUser, onClose }) {
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState('');
  const inputRef                = useRef(null);

  useEffect(() => {
    if (!yComments) return;
    const update = () =>
      setComments(yComments.toArray().filter((c) => c.line === line && !c.resolved));
    update();
    yComments.observe(update);
    return () => yComments.unobserve(update);
  }, [yComments, line]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !yComments || !currentUser) return;
    yComments.push([{
      id:       `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      line,
      text:     trimmed,
      author:   currentUser.username,
      color:    currentUser.color || '#7c3aed',
      ts:       Date.now(),
      resolved: false,
    }]);
    setText('');
  };

  const resolve = (id) => {
    const idx = yComments.toArray().findIndex((c) => c.id === id);
    if (idx === -1) return;
    const updated = { ...yComments.get(idx), resolved: true };
    yComments.delete(idx, 1);
    yComments.insert(idx, [updated]);
  };

  const fmt = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="comment-popover">
      <div className="comment-popover-header">
        <span className="comment-popover-title">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z" />
          </svg>
          Line {line}
        </span>
        <button className="comment-popover-close" onClick={onClose}>✕</button>
      </div>

      {comments.length > 0 && (
        <div className="comment-popover-thread">
          {comments.map((c) => (
            <div key={c.id} className="comment-thread-item">
              <div className="comment-thread-meta">
                <span style={{ color: c.color, fontWeight: 600 }}>{c.author}</span>
                <span className="comment-time">{fmt(c.ts)}</span>
                {c.author === currentUser?.username && (
                  <button
                    className="comment-action-btn"
                    onClick={() => resolve(c.id)}
                    title="Resolve"
                    style={{ marginLeft: 'auto' }}
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="comment-thread-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <form className="comment-popover-form" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="comment-popover-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          maxLength={500}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); }
          }}
        />
        <div className="comment-popover-actions">
          <span className="comment-popover-hint">Enter to submit · Shift+Enter for newline</span>
          <button
            type="submit"
            className="comment-popover-submit"
            disabled={!text.trim()}
          >
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
