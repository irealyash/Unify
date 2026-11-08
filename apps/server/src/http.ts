import type { IncomingMessage, ServerResponse } from "node:http";
import { isAuth0Configured, upsertUser, verifyIdToken } from "./auth";

const WEB_ORIGINS = (process.env.WEB_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function setCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && WEB_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 64_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Minimal HTTP routes alongside Socket.IO.
 * Returns true when the request was handled.
 */
export async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/health") return false;

  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return true;
  }

  if (url.pathname === "/health" && req.method === "GET") {
    json(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === "/api/auth/sync" && req.method === "POST") {
    if (!isAuth0Configured()) {
      json(res, 503, { ok: false, error: "Auth0 is not configured" });
      return true;
    }
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      // Allow token in JSON body as a fallback.
      try {
        await readBody(req);
      } catch {
        /* ignore */
      }
      json(res, 401, { ok: false, error: "Missing Authorization bearer token" });
      return true;
    }
    try {
      const user = await verifyIdToken(token);
      await upsertUser(user);
      json(res, 200, { ok: true, user });
    } catch (err) {
      json(res, 401, {
        ok: false,
        error: err instanceof Error ? err.message : "Invalid token",
      });
    }
    return true;
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    if (!isAuth0Configured()) {
      json(res, 503, { ok: false, error: "Auth0 is not configured" });
      return true;
    }
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      json(res, 401, { ok: false, error: "Missing Authorization bearer token" });
      return true;
    }
    try {
      const user = await verifyIdToken(token);
      json(res, 200, { ok: true, user });
    } catch (err) {
      json(res, 401, {
        ok: false,
        error: err instanceof Error ? err.message : "Invalid token",
      });
    }
    return true;
  }

  return false;
}
