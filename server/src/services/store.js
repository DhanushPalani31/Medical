import { isMongoConnected } from "../config/db.js";
import { Conversation } from "../models/Conversation.js";

// In-memory fallback: sessionId -> conversation object (same shape as the
// Mongoose document's plain fields). Used automatically whenever Mongo isn't
// connected, so the app never breaks on missing/unreachable MONGO_URI.
const memoryStore = new Map();

function freshConversation(sessionId) {
  return {
    sessionId,
    messages: [],
    fields: { age: null, gender: null, disease: null, symptoms: null, history: null },
    step: "age",
    result: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getOrCreateConversation(sessionId) {
  if (isMongoConnected()) {
    let convo = await Conversation.findOne({ sessionId });
    if (!convo) convo = await Conversation.create({ sessionId });
    return convo;
  }

  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, freshConversation(sessionId));
  }
  return memoryStore.get(sessionId);
}

export async function saveConversation(convo) {
  if (isMongoConnected() && typeof convo.save === "function") {
    convo.updatedAt = new Date();
    await convo.save();
    return convo;
  }

  convo.updatedAt = new Date();
  memoryStore.set(convo.sessionId, convo);
  return convo;
}

export async function resetConversation(sessionId) {
  if (isMongoConnected()) {
    await Conversation.deleteOne({ sessionId });
    return Conversation.create({ sessionId });
  }
  const fresh = freshConversation(sessionId);
  memoryStore.set(sessionId, fresh);
  return fresh;
}

export async function deleteConversation(sessionId) {
  if (isMongoConnected()) {
    await Conversation.deleteOne({ sessionId });
    return;
  }
  memoryStore.delete(sessionId);
}

function toSessionSummary(convo) {
  const messages = convo.messages || [];
  const firstUserMessage = messages.find((m) => m.role === "user");
  const preview =
    (convo.fields && convo.fields.disease) ||
    (firstUserMessage && firstUserMessage.text) ||
    "New patient";
  return {
    sessionId: convo.sessionId,
    preview,
    step: convo.step,
    messageCount: messages.length,
    createdAt: convo.createdAt,
    updatedAt: convo.updatedAt,
  };
}

/**
 * Lists recent conversations (newest first) for the sidebar / history panel.
 * Only conversations with at least one real exchange are returned — a
 * freshly-created, untouched session isn't worth showing in the list.
 */
export async function listConversations({ limit = 50 } = {}) {
  let all;
  if (isMongoConnected()) {
    all = await Conversation.find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  } else {
    all = Array.from(memoryStore.values()).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  return all
    .filter((convo) => (convo.messages || []).some((m) => m.role === "user"))
    .slice(0, limit)
    .map(toSessionSummary);
}
