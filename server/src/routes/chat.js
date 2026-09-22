import { Router } from "express";
import { nanoid } from "nanoid";
import {
  getOrCreateConversation,
  saveConversation,
  resetConversation,
  listConversations,
  deleteConversation,
} from "../services/store.js";
import { advanceConversation, firstPrompt, allFieldsCollected } from "../services/conversationFlow.js";
import { predict } from "../services/gradioClient.js";

export const chatRouter = Router();

// Start a new conversation, get a sessionId + the opening bot message.
chatRouter.post("/start", async (req, res) => {
  const sessionId = nanoid();
  const convo = await getOrCreateConversation(sessionId);
  const opening = firstPrompt();
  convo.messages.push({ role: "bot", text: opening });
  await saveConversation(convo);
  res.json({ sessionId, message: opening, step: convo.step });
});

// Send a user message, get the next bot message (and, once all fields are
// collected + confirmed, the prediction result).
chatRouter.post("/message", async (req, res) => {
  const { sessionId, text } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

  const convo = await getOrCreateConversation(sessionId);
  convo.messages.push({ role: "user", text: text ?? "" });

  const { fields, step, botMessage, readyForPrediction } = advanceConversation(convo, text);
  convo.fields = fields;
  convo.step = step;

  if (botMessage) {
    convo.messages.push({ role: "bot", text: botMessage });
  }

  if (!readyForPrediction) {
    await saveConversation(convo);
    return res.json({ sessionId, step: convo.step, message: botMessage, fields: convo.fields });
  }

  // User confirmed — run the prediction.
  if (!allFieldsCollected(fields)) {
    const msg = "Something went missing along the way — let's start over. What's the patient's age?";
    convo.step = "age";
    convo.fields = { age: null, gender: null, disease: null, symptoms: null, history: null };
    convo.messages.push({ role: "bot", text: msg });
    await saveConversation(convo);
    return res.json({ sessionId, step: convo.step, message: msg, fields: convo.fields });
  }

  const inputs = [fields.age, fields.gender, fields.disease, fields.symptoms, fields.history];
  const result = await predict(inputs);

  let finalMessage;
  if (result.ok) {
    convo.result = result.data;
    finalMessage =
      "Here's the prediction based on similar historical cases:\n\n" +
      formatPredictionForChat(result.data);
  } else {
    finalMessage =
      "I couldn't reach the prediction model just now (it may be restarting on Kaggle). " +
      "Please try again in a bit, or check /api/health.";
  }

  convo.messages.push({ role: "bot", text: finalMessage });
  await saveConversation(convo);

  res.json({
    sessionId,
    step: convo.step,
    message: finalMessage,
    fields: convo.fields,
    result: result.ok ? result.data : null,
    predictionOk: result.ok,
  });
});

// List recent conversations for the sidebar / patient-history panel.
// Must be declared before the "/history/:sessionId" route below so the
// literal "/sessions" path isn't swallowed by the ":sessionId" param.
chatRouter.get("/sessions", async (req, res) => {
  const sessions = await listConversations({ limit: 50 });
  res.json({ sessions });
});

chatRouter.delete("/sessions/:sessionId", async (req, res) => {
  await deleteConversation(req.params.sessionId);
  res.json({ ok: true });
});

// Fetch full history for a session (used on client reload).
chatRouter.get("/history/:sessionId", async (req, res) => {
  const convo = await getOrCreateConversation(req.params.sessionId);
  res.json({
    sessionId: convo.sessionId,
    messages: convo.messages,
    step: convo.step,
    fields: convo.fields,
    result: convo.result,
  });
});

// Reset a conversation (e.g. "predict for another patient" button).
chatRouter.post("/reset", async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
  const convo = await resetConversation(sessionId);
  const opening = firstPrompt();
  convo.messages.push({ role: "bot", text: opening });
  await saveConversation(convo);
  res.json({ sessionId, message: opening, step: convo.step });
});

function formatPredictionForChat(data) {
  // Gradio returns outputs positionally, matching however the demo function
  // is defined. We don't know the exact shape until we're against a live
  // endpoint, so render defensively: stringify anything unexpected.
  if (Array.isArray(data)) {
    return data
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item, null, 2)))
      .join("\n\n");
  }
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}
