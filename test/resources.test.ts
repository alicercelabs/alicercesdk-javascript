import { test } from "node:test";
import assert from "node:assert/strict";

import { AlicerceLabs } from "../src/index";
import { TestServer, envelope, errorEnvelope } from "./helpers";

function clientFor(srv: TestServer): AlicerceLabs {
  return new AlicerceLabs({ apiKey: "tok", apiBase: srv.url, accountBase: srv.url });
}

// ---- lookups ----

test("cep.get", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cep/01310100", envelope({ cep: "01310100", logradouro: "Avenida Paulista" }));

  const result = await clientFor(srv).cep.get("01310100");
  assert.equal(result.logradouro, "Avenida Paulista");
  await srv.close();
});

test("trust.check passes cnpj query param", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/trust/exemplo.com", envelope({ score: 90 }));

  await clientFor(srv).trust.check("exemplo.com", { cnpj: "00000000000000" });
  assert.ok(srv.lastRequest?.path.includes("cnpj=00000000000000"));
  await srv.close();
});

// ---- storage ----

test("kv.put then kv.get", async () => {
  const srv = await TestServer.start();
  srv.route("PUT /api/v1/kv/tema", envelope({ message: "gravado" }));
  srv.route("GET /api/v1/kv/tema", envelope({ key: "tema", value: "escuro" }));

  const client = clientFor(srv);
  await client.kv.put("tema", "escuro");
  assert.equal(await client.kv.get("tema"), "escuro");
  await srv.close();
});

test("queue.pull returns null on empty", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/queue/fila/pull", errorEnvelope(404, "fila vazia"));

  const result = await clientFor(srv).queue.pull("fila");
  assert.equal(result, null);
  await srv.close();
});

// ---- jobs ----

test("cron.list", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cron/jobs", envelope([{ id: "1", name: "job" }]));

  const jobs = await clientFor(srv).cron.list();
  assert.equal(jobs[0]?.name, "job");
  await srv.close();
});

// ---- media (binary responses) ----

test("qrcode.generate returns BinaryResponse", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/qrcode", { status: 200, body: Buffer.from("\x89PNGfakepngbytes"), contentType: "image/png" });

  const result = await clientFor(srv).qrcode.generate("hello");
  assert.equal(Buffer.from(result.content).toString(), "\x89PNGfakepngbytes");
  assert.equal(result.contentType, "image/png");
  await srv.close();
});

// ---- compute ----

test("functions.invoke returns BinaryResponse", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/functions/echo/invoke", { status: 200, body: "ola de volta", contentType: "text/plain" });

  const result = await clientFor(srv).functions.invoke("echo", "ola");
  assert.equal(Buffer.from(result.content).toString(), "ola de volta");
  await srv.close();
});

// ---- account ----

test("auth.register stores token on client", async () => {
  const srv = await TestServer.start();
  srv.route(
    "POST /api/v1/user/register",
    envelope({ user: { id: 1, username: "voce" }, token: "new-token" })
  );

  const client = clientFor(srv);
  await client.auth.register("voce", "voce@exemplo.com", "senha1234");
  assert.equal(client.apiKey, "new-token");
  await srv.close();
});

test("account.usage", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/account/usage", envelope([{ api: "cep", operation: "lookup", request_count: 42 }]));

  const rows = await clientFor(srv).account.usage(7);
  assert.equal(rows[0]?.request_count, 42);
  assert.ok(srv.lastRequest?.path.includes("days=7"));
  await srv.close();
});

test("account.apiKeys.create", async () => {
  const srv = await TestServer.start();
  srv.route(
    "POST /api/v1/account/apikeys",
    envelope({ key: "alk_raw", api_key: { id: 1, name: "ci" } })
  );

  const result = await clientFor(srv).account.apiKeys.create("ci");
  assert.equal(result.key, "alk_raw");
  await srv.close();
});

test("edgedb.query", async () => {
  const srv = await TestServer.start();
  srv.route(
    "POST /api/v1/edgedb/meubanco/query",
    envelope({ columns: ["id", "nome"], rows: [[1, "Fulano"]] })
  );

  const result = await clientFor(srv).edgedb.query("meubanco", "SELECT * FROM t");
  assert.equal(result.columns?.length, 2);
  assert.equal(result.rows?.length, 1);
  await srv.close();
});
