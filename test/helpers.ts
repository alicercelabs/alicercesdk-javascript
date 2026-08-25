/**
 * A tiny real HTTP server (not a mocked fetch) that the tests point the
 * SDK at — same "test against something real" discipline the rest of
 * AlicerceLabs is built with.
 */

import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface RouteHandler {
  status: number;
  body: string | Buffer;
  contentType?: string;
  retryAfter?: number;
  headers?: Record<string, string>;
}

export class TestServer {
  private server: Server;
  private routes = new Map<string, RouteHandler>();
  lastRequest: { method: string; path: string; headers: Record<string, string | string[] | undefined>; body: string } | null =
    null;

  url = "";

  private constructor(server: Server) {
    this.server = server;
  }

  static async start(): Promise<TestServer> {
    return new Promise((resolve) => {
      const instance = new TestServer(
        createServer((req, res) => instance.handle(req, res))
      );
      instance.server.listen(0, "127.0.0.1", () => {
        const { port } = instance.server.address() as AddressInfo;
        instance.url = `http://127.0.0.1:${port}`;
        resolve(instance);
      });
    });
  }

  route(methodAndPath: string, handler: RouteHandler): void {
    this.routes.set(methodAndPath, handler);
  }

  private handle(req: IncomingMessage, res: import("node:http").ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const path = (req.url ?? "").split("?")[0];
      const bodyText = Buffer.concat(chunks).toString("utf8");
      this.lastRequest = { method: req.method ?? "", path: req.url ?? "", headers: req.headers, body: bodyText };

      const key = `${req.method} ${path}`;
      const handler = this.routes.get(key);
      if (!handler) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "not found" }));
        return;
      }
      const headers: Record<string, string> = { "Content-Type": handler.contentType ?? "application/json", ...handler.headers };
      if (handler.retryAfter) headers["Retry-After"] = String(handler.retryAfter);
      res.writeHead(handler.status, headers);
      res.end(handler.body);
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}

export function envelope(data: unknown, requestId = "req_test"): RouteHandler {
  return { status: 200, body: JSON.stringify({ success: true, data, meta: { request_id: requestId } }) };
}

export function errorEnvelope(status: number, message: string, retryAfter?: number): RouteHandler {
  return { status, body: JSON.stringify({ success: false, error: message }), retryAfter };
}
