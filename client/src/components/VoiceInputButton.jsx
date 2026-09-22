export default function VoiceInputButton({ supported, isListening, onClick, disabled, error }) {
  if (!supported) return null;
  return (
    <button
      type="button"
      className={`mic-button ${isListening ? "listening" : ""} ${error ? "mic-error" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={
        error
          ? `Mic error: ${error === "not-allowed" ? "microphone permission denied" : error}`
          : isListening
          ? "Listening… click to stop"
          : "Click to speak"
      }
      aria-label="Toggle voice input"
      aria-pressed={isListening}
    >
      {isListening && (
        <>
          <span className="mic-ring mic-ring-1" aria-hidden="true" />
          <span className="mic-ring mic-ring-2" aria-hidden="true" />
        </>
      )}
      {isListening ? (
        <svg className="mic-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
        </svg>
      ) : (
        <svg className="mic-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 0 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 11v1a5.5 5.5 0 0 0 11 0v-1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12 17.5V21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9 21h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
