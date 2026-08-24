/**
 * Account management — registration/login, and the self-service data a
 * logged-in client can see about their own account: API keys and usage
 * analytics. `auth.*` talks to the product API host; `account.*` talks to
 * the panel backend host (where API keys and usage live) — both are
 * configured on the client, you never need to think about which is
 * which.
 */

import type { BaseClient } from "../client";

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface RegisterResult {
  user: User;
  token: string;
}

export class AuthResource {
  constructor(private client: BaseClient) {}

  /** Creates an account and returns `{user, token}`. Also stores the
   * token on the client, so you can start calling other APIs right away
   * without a separate `login()`. */
  async register(username: string, email: string, password: string): Promise<RegisterResult> {
    const result = await this.client.request<RegisterResult>("POST", "/api/v1/user/register", {
      json: { username, email, password },
    });
    this.client.apiKey = result.token;
    return result;
  }

  /** Exchanges username/password for a token (HTTP Basic Auth under the
   * hood). Stores the token on the client and also returns it, in case
   * you want to persist it yourself for next time. */
  async login(username: string, password: string): Promise<string> {
    const result = await this.client.requestBasicAuth<{ token: string }>(
      "POST",
      "/api/v1/user/login",
      username,
      password
    );
    this.client.apiKey = result.token;
    return result.token;
  }

  /** The authenticated account's own profile — id, username, email,
   * role. */
  me(): Promise<User> {
    return this.client.request("GET", "/api/v1/user/me");
  }

  /** Deactivates the authenticated account. Irreversible from the API's
   * side — think before calling this. */
  async deleteAccount(): Promise<void> {
    await this.client.request("DELETE", "/api/v1/user/me");
  }
}

export interface APIKeyRecord {
  id: number;
  name: string;
  key_prefix: string;
  active: boolean;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

export interface CreateAPIKeyResult {
  /** The raw key value (`alk_...`) — only ever present in *this*
   * response. Save it now, it can't be recovered later. */
  key: string;
  api_key: APIKeyRecord;
}

export class APIKeysResource {
  constructor(private client: BaseClient) {}

  list(): Promise<APIKeyRecord[]> {
    return this.client.request("GET", "/api/v1/account/apikeys", { base: this.client.accountBase });
  }

  create(name: string): Promise<CreateAPIKeyResult> {
    return this.client.request("POST", "/api/v1/account/apikeys", {
      base: this.client.accountBase,
      json: { name },
    });
  }

  async revoke(id: number): Promise<void> {
    await this.client.request("DELETE", `/api/v1/account/apikeys/${id}`, { base: this.client.accountBase });
  }
}

export interface UsageRow {
  api: string;
  operation: string;
  day: string;
  status_class: number;
  request_count: number;
}

export class AccountResource {
  readonly apiKeys: APIKeysResource;

  constructor(private client: BaseClient) {
    this.apiKeys = new APIKeysResource(client);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.request("POST", "/api/v1/account/password", {
      base: this.client.accountBase,
      json: { current_password: currentPassword, new_password: newPassword },
    });
  }

  /** Your own usage analytics: request counts per API/operation/day for
   * the last `days` days (default 30 server-side). */
  usage(days = 30): Promise<UsageRow[]> {
    return this.client.request("GET", "/api/v1/account/usage", {
      base: this.client.accountBase,
      query: { days },
    });
  }
}
