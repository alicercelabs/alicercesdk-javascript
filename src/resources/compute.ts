/**
 * Functions — upload a WASM binary, invoke it over HTTP. See
 * https://alicercelabs.com.br/apis/functions for the sandbox's exact
 * guarantees (no network, no filesystem, bounded memory/time) and the
 * stdin/stdout JSON envelope a function itself needs to speak.
 */

import type { BaseClient } from "../client";
import { BinaryResponse } from "../client";

export interface FunctionInfo {
  name: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export class FunctionsResource {
  constructor(private client: BaseClient) {}

  async list(): Promise<FunctionInfo[]> {
    const result = await this.client.request<{ functions: FunctionInfo[] }>("GET", "/api/v1/functions");
    return result.functions;
  }

  get(name: string): Promise<FunctionInfo> {
    return this.client.request("GET", `/api/v1/functions/${name}`);
  }

  /** Uploads a compiled WASM binary — any language that compiles to WASI
   * works, including plain Go (`GOOS=wasip1 GOARCH=wasm go build`). */
  deploy(name: string, wasm: Uint8Array): Promise<FunctionInfo> {
    return this.client.request("PUT", `/api/v1/functions/${name}`, { body: wasm });
  }

  async delete(name: string): Promise<void> {
    await this.client.request("DELETE", `/api/v1/functions/${name}`);
  }

  /** Runs a deployed function. The response is exactly what the function
   * itself produced (status, headers, body) — not the usual envelope,
   * since it's the client's own code's output, not ours. */
  invoke(name: string, body: Uint8Array | string = ""): Promise<BinaryResponse> {
    return this.client.requestRaw("POST", `/api/v1/functions/${name}/invoke`, { body });
  }
}
