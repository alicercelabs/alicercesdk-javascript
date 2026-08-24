/**
 * KV, Queue, Edge DB — the three storage-shaped APIs. Each is scoped to
 * the calling client automatically (by API key/token), same as every
 * other resource.
 */

import type { BaseClient } from "../client";
import { NotFoundError } from "../errors";

export interface KVListResult {
  keys: string[];
  next_cursor: number;
  total: number;
}

export class KVResource {
  constructor(private client: BaseClient) {}

  /** Paginated list of the client's key names (not values). */
  list(options: { cursor?: number; count?: number } = {}): Promise<KVListResult> {
    return this.client.request("GET", "/api/v1/kv", { query: options });
  }

  /** Reads one key's value. Throws `NotFoundError` if it doesn't exist or
   * expired. */
  async get(key: string): Promise<string> {
    const result = await this.client.request<{ key: string; value: string }>("GET", `/api/v1/kv/${key}`);
    return result.value;
  }

  /** Writes a key. `ttlSeconds: 0` (default) means no expiry. */
  async put(key: string, value: string, ttlSeconds = 0): Promise<void> {
    await this.client.request("PUT", `/api/v1/kv/${key}`, { json: { value, ttl_seconds: ttlSeconds } });
  }

  /** Removes a key. Idempotent — deleting a key that doesn't exist is not
   * an error. */
  async delete(key: string): Promise<void> {
    await this.client.request("DELETE", `/api/v1/kv/${key}`);
  }
}

export interface QueueStats {
  name: string;
  depth: number;
}

export class QueueResource {
  constructor(private client: BaseClient) {}

  /** Appends a message to the end of a FIFO queue (created on first
   * use). */
  async push(name: string, message: string): Promise<void> {
    await this.client.request("POST", `/api/v1/queue/${name}/push`, { json: { message } });
  }

  /** Pulls the oldest message. `wait` (0-5 seconds) turns this into a
   * short long-poll instead of an immediate empty check. Returns `null`
   * if the queue is empty. */
  async pull(name: string, wait = 0): Promise<string | null> {
    try {
      const result = await this.client.request<{ message: string }>("POST", `/api/v1/queue/${name}/pull`, {
        query: { wait: wait || undefined },
      });
      return result.message;
    } catch (err) {
      if (err instanceof NotFoundError) return null;
      throw err;
    }
  }

  /** Current depth of a queue. */
  stats(name: string): Promise<QueueStats> {
    return this.client.request("GET", `/api/v1/queue/${name}/stats`);
  }

  /** Removes a queue entirely. Idempotent. */
  async delete(name: string): Promise<void> {
    await this.client.request("DELETE", `/api/v1/queue/${name}`);
  }
}

export interface EdgeDBInfo {
  name: string;
  size_bytes: number;
  updated_at: string;
}

/** `columns`/`rows` are set for SELECT/PRAGMA/EXPLAIN/WITH;
 * `rows_affected`/`last_insert_id` for everything else. */
export interface EdgeDBQueryResult {
  columns?: string[];
  rows?: unknown[][];
  rows_affected?: number;
  last_insert_id?: number;
}

/** A SQLite database per client, created on first query — see
 * https://alicercelabs.com.br/apis/edgedb. */
export class EdgeDBResource {
  constructor(private client: BaseClient) {}

  /** Every database this client has. */
  async list(): Promise<EdgeDBInfo[]> {
    const result = await this.client.request<{ databases: EdgeDBInfo[] }>("GET", "/api/v1/edgedb");
    return result.databases;
  }

  /** Runs one SQL statement. `args` are positional values for the
   * statement's `?` placeholders. */
  query(name: string, sql: string, args: unknown[] = []): Promise<EdgeDBQueryResult> {
    return this.client.request("POST", `/api/v1/edgedb/${name}/query`, { json: { sql, args } });
  }

  /** Deletes a database file entirely. Idempotent. */
  async delete(name: string): Promise<void> {
    await this.client.request("DELETE", `/api/v1/edgedb/${name}`);
  }
}
