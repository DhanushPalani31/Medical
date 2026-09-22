import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble.jsx";
import TypingDots from "./TypingDots.jsx";
import VoiceInputButton from "./VoiceInputButton.jsx";
import Sidebar from "./Sidebar.jsx";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import {
  startConversation,
  sendMessage,
  fetchHistory,
  fetchSessions,
} from "../api/chatApi.js";

// Persist which patient/session the user was last on so a page reload (or
// coming back tomorrow) restores the conversation instead of losing it.
const SESSION_KEY = "prescription-chat-session-id";

export default function ChatWindow() {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("age");
  const [error, setError] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetchSessions();
      setSessions(res.sessions || []);
    } catch {
      // The history sidebar is a nice-to-have; never block the chat on it.
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const beginNewSession = useCallback(async () => {
    setError(null);
    try {
      const res = await startConversation();
      setSessionId(res.sessionId);
      setMessages([{ role: "bot", text: res.message }]);
      setStep(res.step);
      localStorage.setItem(SESSION_KEY, res.sessionId);
      refreshSessions();
    } catch (err) {
      setError(`Couldn't reach the backend at start-up: ${err.message}`);
    }
  }, [refreshSessions]);

  const loadSession = useCallback(async (id) => {
    setError(null);
    try {
      const res = await fetchHistory(id);
      setSessionId(res.sessionId);
      setMessages(res.messages || []);
      setStep(res.step || "age");
      localStorage.setItem(SESSION_KEY, res.sessionId);
    } catch (err) {
      setError(`Couldn't load that patient: ${err.message}`);
    }
  }, []);

  // On first mount: restore the last session from localStorage if it still
  // has real history on the server, otherwise start fresh. Either way,
  // load the sidebar list of past patients.
  useEffect(() => {
    (async () => {
      const savedId = localStorage.getItem(SESSION_KEY);
      if (savedId) {
        try {
          const res = await fetchHistory(savedId);
          if (res.messages && res.messages.length > 0) {
            setSessionId(res.sessionId);
            setMessages(res.messages);
            setStep(res.step || "age");
            refreshSessions();
            return;
          }
        } catch {
          // Saved session is gone (e.g. server restarted with in-memory
          // store) — fall through to starting a fresh one.
        }
      }
      await beginNewSession();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy, atBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distanceFromBottom < 80);
  }

  const speech = useSpeechRecognition({
    onResult: (transcript) => {
      setInput((prev) => {
        const next = prev ? `${prev} ${transcript}` : transcript;
        console.log(`[voice] input box updated -> "${next}"`);
        return next;
      });
    },
  });

  // Auto-grow the textarea as the user types, capped so it doesn't take
  // over the screen on a long dictated answer.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !sessionId || busy) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setBusy(true);
    setError(null);
    setAtBottom(true);

    try {
      const res = await sendMessage(sessionId, text);
      if (res.message) {
        setMessages((prev) => [...prev, { role: "bot", text: res.message }]);
      }
      setStep(res.step);
      if (res.predictionOk === false) {
        setError("The prediction model didn't respond — check the Kaggle session / GRADIO_BASE_URL.");
      }
      refreshSessions();
    } catch (err) {
      setError(`Message failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleNewPatient() {
    setSidebarOpen(false);
    await beginNewSession();
  }

  function handleSelectSession(id) {
    setSidebarOpen(false);
    if (id !== sessionId) loadSession(id);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        sessions={sessions}
        activeSessionId={sessionId}
        onSelect={handleSelectSession}
        onNewChat={handleNewPatient}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        loading={sessionsLoading}
      />

      <div className="chat-window">
        <header className="chat-header">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle patient history"
          >
            <span className="hamburger" />
          </button>
          <div className="chat-header-title">
            <h1>Prescription Predictor</h1>
            <span className="chat-header-badges">
              <span className="badge badge-accent" title="Fine-tuned clinical LLM + RAG grounding">
                Clinical AI
              </span>
              <span className="badge badge-live">
                <span className="badge-dot" aria-hidden="true" />
                Live
              </span>
            </span>
          </div>
          <button type="button" className="reset-button" onClick={handleNewPatient} disabled={busy}>
            New patient
          </button>
        </header>

        <div className="chat-messages" ref={scrollRef} onScroll={handleScroll}>
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} text={m.text} />
          ))}
          {busy && (
            <div className="bubble-row bot enter">
              <div className="avatar avatar-bot" aria-hidden="true">
                Rx
              </div>
              <div className="bubble bot typing-bubble">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        {!atBottom && (
          <button
            type="button"
            className="scroll-bottom-button"
            onClick={() => setAtBottom(true)}
          >
            ↓ New messages
          </button>
        )}

        {error && <div className="chat-error">{error}</div>}

        {speech.isListening && (
          <div className="listening-banner">
            <span className="listening-pulse" aria-hidden="true" />
            {speech.interimTranscript || "Listening…"}
          </div>
        )}
        {speech.error && !speech.isListening && (
          <div className="chat-error subtle">{describeMicError(speech.error)}</div>
        )}

        <form className="chat-input-row" onSubmit={handleSend}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={step === "confirm" ? 'Type "yes" to predict…' : "Type your answer…"}
            disabled={busy || !sessionId}
          />
          <VoiceInputButton
            supported={speech.supported}
            isListening={speech.isListening}
            onClick={speech.isListening ? speech.stop : speech.start}
            disabled={busy || !sessionId}
            error={speech.error}
          />
          <button
            type="submit"
            className="send-button"
            disabled={busy || !sessionId || !input.trim()}
            aria-label="Send message"
          >
            <svg className="send-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12h15M13 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function describeMicError(code) {
  switch (code) {
    case "not-allowed":
    case "permission-denied":
      return "Mic permission denied — allow microphone access in the browser's site settings and try again.";
    case "no-speech":
      return "Didn't catch anything — tap the mic and try again (speak right after tapping).";
    case "audio-capture":
      return "No microphone found — check that one is connected and not in use by another app.";
    case "network":
      return "Voice recognition needs an internet connection (it runs on Google's servers, not locally) — check your connection and try again.";
    default:
      return `Mic error: ${code}`;
  }
}
