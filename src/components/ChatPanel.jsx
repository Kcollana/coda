import { useState, useEffect, useRef } from 'react';

export default function ChatPanel({ yChat, userName, userColor }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!yChat) return;
    const update = () => setMessages(yChat.toArray());
    update();
    yChat.observe(update);
    return () => yChat.unobserve(update);
  }, [yChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !yChat) return;
    yChat.push([{ text, user: userName, color: userColor, ts: Date.now() }]);
    setInput('');
    inputRef.current?.focus();
  };

  const fmt = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Say hello!</div>
        )}
        {messages.map((msg, i) => {
          const showAuthor = i === 0 || messages[i - 1].user !== msg.user;
          return (
            <div key={i} className="chat-msg">
              {showAuthor && (
                <div className="chat-author">
                  <span style={{ color: msg.color }}>{msg.user}</span>
                  <span className="chat-time">{fmt(msg.ts)}</span>
                </div>
              )}
              <div className="chat-bubble">{msg.text}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message…"
          className="chat-input"
          maxLength={500}
        />
        <button type="submit" className="chat-send" disabled={!input.trim()}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
