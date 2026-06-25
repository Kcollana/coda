import { useState, useEffect, useRef, useCallback } from 'react';

function Dropdown({ items, onClose }) {
  return (
    <div className="menu-dropdown">
      {items.map((item, i) => {
        if (item.type === 'sep') return <div key={i} className="menu-sep" />;
        if (item.type === 'heading') return <div key={i} className="menu-heading">{item.label}</div>;
        return (
          <button
            key={i}
            className={`menu-option ${item.disabled ? 'disabled' : ''} ${item.checked ? 'checked' : ''}`}
            onClick={() => {
              if (item.disabled) return;
              item.action?.();
              onClose();
            }}
          >
            <span className="menu-option-check">{item.checked ? '✓' : ''}</span>
            <span className="menu-option-label">{item.label}</span>
            {item.shortcut && <span className="menu-option-shortcut">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function TitleBar({ menus, peers, user, roomName }) {
  const [openIdx, setOpenIdx] = useState(null);
  const barRef = useRef(null);

  const close = useCallback(() => setOpenIdx(null), []);

  useEffect(() => {
    if (openIdx === null) return;
    const handler = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) close();
    };
    const escHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [openIdx, close]);

  return (
    <div className="title-bar" ref={barRef}>
      {/* Left — logo */}
      <div className="title-bar-logo">
        <span className="title-logo-text">coda</span>
      </div>

      {/* Center — menu */}
      <nav className="title-menu">
        {menus.map((menu, i) => (
          <div key={menu.label} className="menu-entry">
            <button
              className={`menu-label ${openIdx === i ? 'active' : ''}`}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              onMouseEnter={() => openIdx !== null && setOpenIdx(i)}
            >
              {menu.label}
            </button>
            {openIdx === i && <Dropdown items={menu.items} onClose={close} />}
          </div>
        ))}
      </nav>

      {/* Right — room name + peer avatars */}
      <div className="title-bar-right">
        {roomName && <span className="title-room-name">{roomName}</span>}

        <div className="title-avatars">
          {/* own avatar */}
          {user && (
            <div
              className="title-avatar self"
              style={{ background: user.color || '#7c3aed' }}
              title={`${user.username} (you)`}
            >
              {user.username?.[0]?.toUpperCase()}
            </div>
          )}
          {/* other peers */}
          {peers
            .filter((p) => p.id !== (user?.id || user?._id))
            .map((p, i) => (
              <div
                key={`${p.id}-${i}`}
                className="title-avatar"
                style={{ background: p.color }}
                title={p.name}
              >
                {p.name?.[0]?.toUpperCase()}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
