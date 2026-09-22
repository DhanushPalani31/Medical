// Tiny markdown-lite: renders **bold** spans inline. Enough for the
// prediction text coming back from the model without pulling in a full
// markdown dependency.
function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    )
  );
}

export default function MessageBubble({ role, text, animate = true }) {
  const isBot = role === "bot";
  const lines = String(text).split("\n");

  return (
    <div className={`bubble-row ${isBot ? "bot" : "user"} ${animate ? "enter" : ""}`}>
      {isBot && (
        <div className="avatar avatar-bot" aria-hidden="true">
          Rx
        </div>
      )}
      <div className={`bubble ${isBot ? "bot" : "user"}`}>
        {lines.map((line, i) => {
          const trimmed = line.trim();
          const isBullet = /^[•\-]\s+/.test(trimmed);

          if (isBullet) {
            return (
              <div className="bubble-bullet" key={i}>
                <span className="bubble-bullet-dot" aria-hidden="true" />
                <span>{renderInline(trimmed.replace(/^[•\-]\s+/, ""), i)}</span>
              </div>
            );
          }

          if (!trimmed) {
            return <div key={i} className="bubble-spacer" />;
          }

          return (
            <p key={i} className="bubble-line">
              {renderInline(line, i)}
            </p>
          );
        })}
      </div>
      {!isBot && (
        <div className="avatar avatar-user" aria-hidden="true">
          You
        </div>
      )}
    </div>
  );
}
