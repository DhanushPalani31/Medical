import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectMongo } from "./config/db.js";
import { chatRouter } from "./routes/chat.js";
import { configRouter } from "./routes/config.js";

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

async function main() {
  await connectMongo();

  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json());

  app.get("/", (req, res) => {
    res.json({ name: "prescription-chat-server", status: "ok" });
  });

  app.use("/api/chat", chatRouter);
  app.use("/api", configRouter);

  app.use((err, req, res, next) => {
    console.error("[error]", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  });

  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(
      process.env.GRADIO_BASE_URL
        ? `[server] GRADIO_BASE_URL = ${process.env.GRADIO_BASE_URL}`
        : "[server] GRADIO_BASE_URL not set — /api/chat/message will report prediction failures until it is"
    );
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
