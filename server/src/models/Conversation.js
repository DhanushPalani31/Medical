import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "bot"], required: true },
    text: { type: String, required: true },
    ts: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  messages: { type: [MessageSchema], default: [] },
  fields: {
    age: { type: Number, default: null },
    gender: { type: String, default: null },
    disease: { type: String, default: null },
    symptoms: { type: String, default: null },
    history: { type: String, default: null },
  },
  step: { type: String, default: "age" },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ConversationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
