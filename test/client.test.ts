import { test } from "node:test";
import assert from "node:assert/strict";

import { AlicerceLabs } from "../src/index";
import { ValidationError, AuthenticationError, NotFoundError, ServiceUnavailableError, RateLimitError } from "../src/errors";
import { TestServer, envelope, errorEnvelope } from "./helpers";

test("successful call unwraps data", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/ip/8.8.8.8", envelope({ ip: "8.8.8.8", country: "US" }));

  const client = new AlicerceLabs({ apiKey: "tok", apiBase: srv.url });
  const result = await client.ip.lookup("8.8.8.8");

  assert.deepEqual(result, { ip: "8.8.8.8", country: "US" });
  await srv.close();
});

test("sends bearer header", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/ip/8.8.8.8", envelope({}));

  const client = new AlicerceLabs({ apiKey: "alk_abc123", apiBase: srv.url });
  await client.ip.lookup("8.8.8.8");

  assert.equal(srv.lastRequest?.headers["authorization"], "Bearer alk_abc123");
  await srv.close();
});

test("error status maps to typed exception", async () => {
  const cases: [number, new (...args: any[]) => Error][] = [
    [400, ValidationError],
    [401, AuthenticationError],
    [404, NotFoundError],
    [503, ServiceUnavailableError],
  ];
  for (const [status, ErrorClass] of cases) {
    const srv = await TestServer.start();
    srv.route("GET /api/v1/ip/8.8.8.8", errorEnvelope(status, "something went wrong"));

    const client = new AlicerceLabs({ apiKey: "tok", apiBase: srv.url });
    await assert.rejects(() => client.ip.lookup("8.8.8.8"), (err: unknown) => {
      assert.ok(err instanceof ErrorClass, `expected ${ErrorClass.name}, got ${(err as Error).constructor.name}`);
      assert.equal((err as any).statusCode, status);
      assert.equal((err as Error).message, "something went wrong");
      return true;
    });
    await srv.close();
  }
});

test("rate limit error carries retryAfter", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/ip/8.8.8.8", errorEnvelope(429, "rate limit exceeded", 60));

  const client = new AlicerceLabs({ apiKey: "tok", apiBase: srv.url });
  await assert.rejects(() => client.ip.lookup("8.8.8.8"), (err: unknown) => {
    assert.ok(err instanceof RateLimitError);
    assert.equal(err.retryAfter, 60);
    return true;
  });
  await srv.close();
});

test("falsy query params are dropped, not sent as literal values", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cep/01310100", envelope({}));

  const client = new AlicerceLabs({ apiKey: "tok", apiBase: srv.url });
  await client.cep.get("01310100"); // ddd left undefined -> dropped, not sent as "ddd=undefined"

  assert.ok(!srv.lastRequest?.path.includes("ddd"));
  await srv.close();
});
