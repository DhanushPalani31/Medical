import { Router } from "express";
import { checkHealth } from "../services/gradioClient.js";

export const configRouter = Router();

// Check whether the currently configured GRADIO_BASE_URL is reachable —
// lets you verify the Kaggle demo is live without opening Kaggle.
configRouter.get("/health", async (req, res) => {
  const health = await checkHealth();
  res.json({
    gradioConfigured: Boolean(process.env.GRADIO_BASE_URL),
    gradioBaseUrl: process.env.GRADIO_BASE_URL || null,
    ...health,
  });
});

// Update the Gradio URL at runtime without restarting the server — handy
// since the Kaggle URL rotates every relaunch (see README).
configRouter.patch("/config", async (req, res) => {
  const { gradioBaseUrl } = req.body || {};
  if (!gradioBaseUrl || typeof gradioBaseUrl !== "string") {
    return res.status(400).json({ error: "gradioBaseUrl (string) is required" });
  }
  process.env.GRADIO_BASE_URL = gradioBaseUrl.trim();
  const health = await checkHealth();
  res.json({ gradioBaseUrl: process.env.GRADIO_BASE_URL, ...health });
});
