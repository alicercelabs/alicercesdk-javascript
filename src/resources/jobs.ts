/**
 * Cron and UpTime — the two APIs backed by a long-running daemon the
 * client can start/stop/check the status of, in addition to the usual
 * CRUD.
 */

import type { BaseClient } from "../client";

/** A scheduled job — the exact field set accepted by create/update
 * mirrors the Cron docs page (name, schedule, image, command, and a few
 * more). */
export type CronJob = Record<string, unknown>;

export class CronResource {
  constructor(private client: BaseClient) {}

  create(job: CronJob): Promise<CronJob> {
    return this.client.request("POST", "/api/v1/cron/jobs", { json: job });
  }

  list(): Promise<CronJob[]> {
    return this.client.request("GET", "/api/v1/cron/jobs");
  }

  get(id: string): Promise<CronJob> {
    return this.client.request("GET", `/api/v1/cron/jobs/${id}`);
  }

  update(id: string, fields: CronJob): Promise<CronJob> {
    return this.client.request("PUT", `/api/v1/cron/jobs/${id}`, { json: fields });
  }

  async delete(id: string): Promise<void> {
    await this.client.request("DELETE", `/api/v1/cron/jobs/${id}`);
  }

  /** Runs a job right now, outside its schedule. */
  async trigger(id: string): Promise<void> {
    await this.client.request("POST", `/api/v1/cron/jobs/${id}/trigger`);
  }

  workerStatus(): Promise<Record<string, unknown>> {
    return this.client.request("GET", "/api/v1/cron/worker/status");
  }

  async workerStart(): Promise<void> {
    await this.client.request("POST", "/api/v1/cron/worker/start");
  }

  async workerStop(): Promise<void> {
    await this.client.request("POST", "/api/v1/cron/worker/stop");
  }
}

export type UpTimeMonitor = Record<string, unknown>;

export class UpTimeResource {
  constructor(private client: BaseClient) {}

  /** fields can include method, expected_status, interval_sec,
   * timeout_sec. */
  create(url: string, fields: UpTimeMonitor = {}): Promise<UpTimeMonitor> {
    return this.client.request("POST", "/api/v1/uptime/monitors", { json: { url, ...fields } });
  }

  list(): Promise<UpTimeMonitor[]> {
    return this.client.request("GET", "/api/v1/uptime/monitors");
  }

  get(id: string): Promise<UpTimeMonitor> {
    return this.client.request("GET", `/api/v1/uptime/monitors/${id}`);
  }

  update(id: string, fields: UpTimeMonitor): Promise<UpTimeMonitor> {
    return this.client.request("PUT", `/api/v1/uptime/monitors/${id}`, { json: fields });
  }

  async delete(id: string): Promise<void> {
    await this.client.request("DELETE", `/api/v1/uptime/monitors/${id}`);
  }

  /** Check history for one monitor. */
  checks(id: string): Promise<Record<string, unknown>[]> {
    return this.client.request("GET", `/api/v1/uptime/monitors/${id}/checks`);
  }

  workerStatus(): Promise<Record<string, unknown>> {
    return this.client.request("GET", "/api/v1/uptime/worker/status");
  }

  async workerStart(): Promise<void> {
    await this.client.request("POST", "/api/v1/uptime/worker/start");
  }

  async workerStop(): Promise<void> {
    await this.client.request("POST", "/api/v1/uptime/worker/stop");
  }
}
