import { useEffect, useRef, useState } from 'react';

export default function ChatToast({ yChat, currentUser, chatVisible, onOpen }) {
  const [toast, setToast] = useState(null);
  const prevLenRef = useRef(0);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (!yChat) return;
    prevLenRef.current = yChat.length;

    const observe = () => {
      const msgs    = yChat.toArray();
      const newMsgs = msgs.slice(prevLenRef.current);
      prevLenRef.current = msgs.length;

      const incoming = newMsgs.filter((m) => m.user !== currentUser?.username);
      if (incoming.length === 0) return;

      const last = incoming[incoming.length - 1];
      setToast(last);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), 4500);
    };

    yChat.observe(observe);
    return () => {
      yChat.unobserve(observe);
      clearTimeout(timerRef.current);
    };
  }, [yChat, currentUser]);

  // dismiss when the user opens chat
  useEffect(() => {
    if (chatVisible) setToast(null);
  }, [chatVisible]);

  if (!toast || chatVisible) return null;

  const dismiss = (e) => { e.stopPropagation(); setToast(null); };
  const open    = () => { onOpen(); setToast(null); };

  return (
    <div className="chat-toast" onClick={open} role="button" tabIndex={0}>
      <div className="chat-toast-header">
        <div className="chat-toast-icon">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
          <span style={{ color: toast.color }}>{toast.user}</span>
        </div>
        <button className="chat-toast-close" onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
      <div className="chat-toast-body">{toast.text}</div>
    </div>
  );
}
