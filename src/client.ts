/**
 * Core HTTP client shared by every resource.
 *
 * Every AlicerceLabs API answers with the same envelope on success —
 * `{"success": true, "data": ..., "meta": {...}}` — except QRCode,
 * Imagem's `/transform`, Templating, and Functions' `/invoke`, which
 * answer with raw bytes (an image, a PDF, or whatever the client's own
 * function returned). `request()` handles the JSON case; `requestRaw()`
 * handles the raw-bytes case. Both throw the same typed errors on
 * failure, since errors are *always* the JSON envelope, even for
 * raw-bytes endpoints.
 */

import { errorForStatus, AlicerceLabsError } from "./errors";

export const DEFAULT_API_BASE = "https://api.alicercelabs.com.br";
export const DEFAULT_ACCOUNT_BASE = "https://app.alicercelabs.com.br";

export interface ClientOptions {
  /** Your token (JWT from login/register) or a static API key
   * (`alk_...` from the panel). Optional if you're about to call
   * `client.auth.register()`/`login()`. */
  apiKey?: string;
  /** Override the product API host — defaults to
   * `https://api.alicercelabs.com.br`. Only needed for local development
   * against a self-hosted instance. */
  apiBase?: string;
  /** Override the panel/account API host — defaults to
   * `https://app.alicercelabs.com.br`. */
  accountBase?: string;
  /** Request timeout in milliseconds, applied to every call. Defaults to
   * 30000. */
  timeoutMs?: number;
  /** Override the fetch implementation — mainly for tests. Defaults to
   * the global `fetch`. */
  fetch?: typeof fetch;
}

/** What a raw-bytes endpoint (QRCode, Imagem transform, Templating,
 * Functions invoke) returns. `statusCode` and `headers` matter mainly for
 * Functions' `invoke` — its status/headers are whatever the client's own
 * function set, not a fixed content type like the others. */
export class BinaryResponse {
  constructor(
    public readonly content: Uint8Array,
    public readonly contentType: string,
    public readonly statusCode: number,
    public readonly headers: Headers
  ) {}

  /** Writes the bytes to a file — the common thing you want to do with a
   * generated image or PDF. Node.js only. */
  async save(path: string): Promise<void> {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, this.content);
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { elapsed_ms?: number; request_id?: string };
}

export interface RequestOptions {
  base?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  json?: unknown;
  body?: Uint8Array | string;
  headers?: Record<string, string>;
}

export class BaseClient {
  apiKey?: string;
  apiBase: string;
  accountBase: string;
  timeoutMs: number;
  private fetchImpl: typeof fetch;

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.apiBase = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/$/, "");
    this.accountBase = (options.accountBase ?? DEFAULT_ACCOUNT_BASE).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private buildURL(base: string, path: string, query?: RequestOptions["query"]): string {
    const url = new URL(base + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === false) continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async rawFetch(method: string, base: string, path: string, opts: RequestOptions): Promise<Response> {
    const url = this.buildURL(base, path, opts.query);
    const headers: Record<string, string> = { ...opts.headers };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    let body: BodyInit | undefined;
    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    } else if (opts.body !== undefined) {
      // Cast needed because TS 5.7+'s generic Uint8Array<ArrayBufferLike>
      // doesn't structurally match lib.dom.d.ts's BodyInit in every
      // typescript/@types/node combination — a type-checker quirk, not a
      // real runtime issue: fetch has always accepted a Uint8Array body.
      body = opts.body as BodyInit;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { method, headers, body, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async errorFromResponse(resp: Response): Promise<AlicerceLabsError> {
    let message = `unexpected response (status ${resp.status})`;
    let requestId: string | undefined;
    try {
      const env = (await resp.clone().json()) as Envelope<unknown>;
      if (env?.error) message = env.error;
      requestId = env?.meta?.request_id;
    } catch {
      // body wasn't JSON — keep the generic message
    }
    let retryAfter: number | undefined;
    if (resp.status === 429) {
      const header = resp.headers.get("Retry-After");
      if (header) retryAfter = parseInt(header, 10) || undefined;
    }
    return errorForStatus(resp.status, message, { requestId, retryAfter });
  }

  /** Calls a JSON-envelope endpoint and returns `data` already unwrapped
   * from `{"success": true, "data": ...}`. */
  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const resp = await this.rawFetch(method, opts.base ?? this.apiBase, path, opts);
    if (!resp.ok) throw await this.errorFromResponse(resp);
    const text = await resp.text();
    if (!text) return undefined as T;
    const env = JSON.parse(text) as Envelope<T>;
    return env.data as T;
  }

  /** Calls one of the raw-bytes endpoints. Errors from these still come
   * back as the normal JSON envelope, so error handling is unchanged —
   * only the success path is bytes instead of JSON. */
  async requestRaw(method: string, path: string, opts: RequestOptions = {}): Promise<BinaryResponse> {
    const resp = await this.rawFetch(method, opts.base ?? this.apiBase, path, opts);
    if (!resp.ok) throw await this.errorFromResponse(resp);
    const buffer = new Uint8Array(await resp.arrayBuffer());
    return new BinaryResponse(buffer, resp.headers.get("Content-Type") ?? "application/octet-stream", resp.status, resp.headers);
  }

  /** Used only by Auth.login, which authenticates via HTTP Basic Auth
   * instead of the Bearer header every other endpoint uses. */
  async requestBasicAuth<T>(method: string, path: string, username: string, password: string): Promise<T> {
    const url = this.buildURL(this.apiBase, path);
    const basic = Buffer.from(`${username}:${password}`).toString("base64");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let resp: Response;
    try {
      resp = await this.fetchImpl(url, { method, headers: { Authorization: `Basic ${basic}` }, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) throw await this.errorFromResponse(resp);
    const env = (await resp.json()) as Envelope<T>;
    return env.data as T;
  }
}
