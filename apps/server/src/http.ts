import type { IncomingMessage, ServerResponse } from "node:http";

/** The one plain HTTP route alongside Socket.IO, for host platforms to check the server is up. */
export function handleHttp(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.url !== "/health" || req.method !== "GET") return false;
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
  return true;
}
