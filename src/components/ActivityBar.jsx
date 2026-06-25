const ITEMS = [
  {
    id: 'explorer',
    title: 'Explorer',
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" /></svg>,
  },
  {
    id: 'users',
    title: 'Collaborators',
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>,
  },
  {
    id: 'chat',
    title: 'Chat',
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" /></svg>,
  },
  {
    id: 'comments',
    title: 'Comments',
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" /></svg>,
  },
  {
    id: 'run',
    title: 'Run Code',
    icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
  },
];

export default function ActivityBar({ active, onSelect, commentCount }) {
  return (
    <div className="activity-bar">
      <div className="ab-logo">co</div>
      <div className="activity-bar-items">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`activity-btn ${active === item.id ? 'active' : ''}`}
            title={item.title}
            onClick={() => onSelect(item.id)}
          >
            {item.icon}
            {item.id === 'comments' && commentCount > 0 && (
              <span className="ab-badge">{commentCount}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
