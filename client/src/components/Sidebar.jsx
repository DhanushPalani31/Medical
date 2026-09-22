function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  isOpen,
  onClose,
  loading,
}) {
  return (
    <>
      <div
        className={`sidebar-scrim ${isOpen ? "visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title-group">
            <span className="sidebar-title">Patients</span>
            <span className="badge badge-outline">
              <svg className="badge-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3l7 3v5c0 4.4-2.9 8.3-7 10-4.1-1.7-7-5.6-7-10V6l7-3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              Encrypted
            </span>
          </span>
          <button type="button" className="new-chat-button" onClick={onNewChat}>
            <span className="plus-icon" aria-hidden="true">
              +
            </span>
            New
          </button>
        </div>

        <div className="sidebar-list">
          {loading && <div className="sidebar-empty">Loading history…</div>}
          {!loading && sessions.length === 0 && (
            <div className="sidebar-empty">No past patients yet — start one below.</div>
          )}
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              type="button"
              className={`sidebar-item ${s.sessionId === activeSessionId ? "active" : ""}`}
              onClick={() => onSelect(s.sessionId)}
            >
              <span className="sidebar-item-dot" aria-hidden="true" />
              <span className="sidebar-item-body">
                <span className="sidebar-item-title">{s.preview || "New patient"}</span>
                <span className="sidebar-item-meta">{timeAgo(s.updatedAt)}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className="badge badge-accent">Premium</span>
          <span style={{ marginLeft: 8, color: "var(--text-faint)", fontSize: 11 }}>
            Stored securely per session
          </span>
        </div>
      </aside>
    </>
  );
}
