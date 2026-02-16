// server.js (ESM, en la RAÍZ del proyecto)
// api/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths importantes
const apiRoot = path.join(__dirname); // /api
const repoRoot = path.join(apiRoot, ".."); // /
const publicDir = path.join(repoRoot, "dashboard"); // /dashboard
const seedPath = path.join(apiRoot, "seed.json"); // /api/seed.json

app.use(cors());
app.use(express.json());

// Servir frontend
app.use(express.static(publicDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Healthcheck
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// API del dashboard
app.get("/dashboard", async (_req, res, next) => {
  try {
    const raw = await fs.readFile(seedPath, "utf8");
    const data = JSON.parse(raw);

    data.metrics = Array.isArray(data.metrics) ? data.metrics : [];
    data.transactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 404
app.use((req, res) => {
  if (req.accepts("html")) {
    return res.status(404).send(`
      <html><body style="font-family:system-ui;padding:24px">
        <h1>404</h1><p>Ruta no encontrada</p>
      </body></html>
    `);
  }
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
