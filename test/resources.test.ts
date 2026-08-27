/**
 * One test per API method — every endpoint the SDK exposes gets a route
 * and a real request through a real HTTP server. client.test.ts covers the
 * request/error machinery itself (auth header, query encoding, error
 * mapping) — this file is just breadth: 62 methods, 62 checks that the
 * right verb hits the right path and unwraps the right field.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { AlicerceLabs } from "../src/index";
import { TestServer, envelope, errorEnvelope } from "./helpers";

function clientFor(srv: TestServer): AlicerceLabs {
  return new AlicerceLabs({ apiKey: "tok", apiBase: srv.url, accountBase: srv.url });
}

// ---- ip ----

test("ip.lookup", async () => {
  const srv = await TestServer.start();
  srv.route(
    "GET /api/v1/ip/8.8.8.8",
    envelope({
      ip: "8.8.8.8",
      version: 4,
      scope: "public",
      routable: true,
      location: { country: { code: "US", name: "United States", is_eu: false } },
    }),
  );

  const result = await clientFor(srv).ip.lookup("8.8.8.8");
  assert.equal(result.location?.country?.code, "US");
  await srv.close();
});

test("ip.self", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/ip/self", envelope({ ip: "203.0.113.9", version: 4, scope: "public", routable: true }));

  const result = await clientFor(srv).ip.self();
  assert.equal(result.ip, "203.0.113.9");
  await srv.close();
});

test("ip.batch", async () => {
  const srv = await TestServer.start();
  srv.route(
    "POST /api/v1/ip/batch",
    envelope({
      results: [
        { ip: "8.8.8.8", success: true, data: { ip: "8.8.8.8", version: 4, scope: "public", routable: true } },
        { ip: "not-an-ip", success: false, error: { code: "INVALID_IP", message: "invalid IP address format" } },
      ],
    }),
  );

  const result = await clientFor(srv).ip.batch(["8.8.8.8", "not-an-ip"]);
  assert.equal(result.length, 2);
  assert.equal(result[0].success, true);
  assert.equal(result[1].success, false);
  await srv.close();
});

// ---- cnpj ----

test("cnpj.get", async () => {
  const srv = await TestServer.start();
  srv.route(
    "GET /api/v1/cnpj/33683111000280",
    envelope({ cnpj: "33683111000280", razao_social: "SERVICO FEDERAL DE PROCESSAMENTO DE DADOS (SERPRO)" }),
  );

  const result = await clientFor(srv).cnpj.get("33683111000280");
  assert.equal(result.razao_social, "SERVICO FEDERAL DE PROCESSAMENTO DE DADOS (SERPRO)");
  await srv.close();
});

// ---- cep ----

test("cep.get", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cep/01310100", envelope({ cep: "01310100", logradouro: "Avenida Paulista" }));

  const result = await clientFor(srv).cep.get("01310100");
  assert.equal(result.logradouro, "Avenida Paulista");
  await srv.close();
});

test("cep.search", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cep/busca", envelope([{ cep: "01310100", logradouro: "Avenida Paulista" }]));

  const result = await clientFor(srv).cep.search("SP", "São Paulo", "Avenida Paulista");
  assert.equal(result[0]?.cep, "01310100");
  await srv.close();
});

test("cep.cities", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cep/cidades", envelope(["São Paulo", "Campinas"]));

  const result = await clientFor(srv).cep.cities("SP");
  assert.deepEqual(result, ["São Paulo", "Campinas"]);
  await srv.close();
});

test("cep.neighborhoods", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cep/bairros", envelope(["Bela Vista", "Jardins"]));

  const result = await clientFor(srv).cep.neighborhoods("SP", "São Paulo");
  assert.deepEqual(result, ["Bela Vista", "Jardins"]);
  await srv.close();
});

test("cep.distance", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cep/distance/01310100/13083010", envelope({ distance_km: 96.4 }));

  const result = await clientFor(srv).cep.distance("01310100", "13083010");
  assert.equal(result.distance_km, 96.4);
  await srv.close();
});

test("cep.bulk", async () => {
  const srv = await TestServer.start();
  srv.route(
    "POST /api/v1/cep/lote",
    envelope([{ cep: "01310100", endereco: { logradouro: "Avenida Paulista" } }])
  );

  const result = await clientFor(srv).cep.bulk(["01310100"]);
  assert.ok(srv.lastRequest?.body.includes("01310100"));
  assert.equal(result[0]?.endereco?.logradouro, "Avenida Paulista");
  await srv.close();
});

// ---- dns ----

test("dns.lookup", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/dns/exemplo.com", envelope({ domain: "exemplo.com" }));

  const result = await clientFor(srv).dns.lookup("exemplo.com");
  assert.equal(result.domain, "exemplo.com");
  await srv.close();
});

// ---- email ----

test("email.verify", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/email/verify", envelope({ email: "gente@exemplo.com", valid: true }));

  const result = await clientFor(srv).email.verify("gente@exemplo.com");
  assert.equal(result.valid, true);
  await srv.close();
});

// ---- ssl ----

test("ssl.check", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/ssl/exemplo.com", envelope({ domain: "exemplo.com", is_valid: true }));

  const result = await clientFor(srv).ssl.check("exemplo.com");
  assert.equal(result.is_valid, true);
  await srv.close();
});

// ---- maps ----

test("maps.geocode", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/maps/geocode", envelope({ address: "Avenida Paulista, 1000", lat: -23.56, lon: -46.65 }));

  const result = await clientFor(srv).maps.geocode("Avenida Paulista, 1000");
  assert.equal(result.lat, -23.56);
  await srv.close();
});

test("maps.reverse", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/maps/reverse", envelope({ address: "Avenida Paulista, 1000", lat: -23.56, lon: -46.65 }));

  const result = await clientFor(srv).maps.reverse(-23.56, -46.65);
  assert.equal(result.address, "Avenida Paulista, 1000");
  await srv.close();
});

test("maps.route", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/maps/route", envelope({ distance_km: 12.3, duration_min: 25 }));

  const result = await clientFor(srv).maps.route("-23.56,-46.65", "-23.5,-46.6");
  assert.equal(result.duration_min, 25);
  await srv.close();
});

// ---- trust ----

test("trust.check passes cnpj query param", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/trust/exemplo.com", envelope({ score: 90 }));

  await clientFor(srv).trust.check("exemplo.com", { cnpj: "00000000000000" });
  assert.ok(srv.lastRequest?.path.includes("cnpj=00000000000000"));
  await srv.close();
});

// ---- kv ----

test("kv.list", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/kv", envelope({ keys: ["tema"], next_cursor: 0, total: 1 }));

  const result = await clientFor(srv).kv.list();
  assert.deepEqual(result.keys, ["tema"]);
  await srv.close();
});

test("kv.get", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/kv/tema", envelope({ key: "tema", value: "escuro" }));

  const result = await clientFor(srv).kv.get("tema");
  assert.equal(result, "escuro");
  await srv.close();
});

test("kv.put", async () => {
  const srv = await TestServer.start();
  srv.route("PUT /api/v1/kv/tema", envelope({ message: "gravado" }));

  await clientFor(srv).kv.put("tema", "escuro", 3600);
  assert.ok(srv.lastRequest?.body.includes("3600"));
  await srv.close();
});

test("kv.delete", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/kv/tema", envelope({}));

  await clientFor(srv).kv.delete("tema");
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});

// ---- queue ----

test("queue.push", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/queue/fila/push", envelope({}));

  await clientFor(srv).queue.push("fila", "pedido-123");
  assert.ok(srv.lastRequest?.body.includes("pedido-123"));
  await srv.close();
});

test("queue.pull returns null on empty", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/queue/fila/pull", errorEnvelope(404, "fila vazia"));

  const result = await clientFor(srv).queue.pull("fila");
  assert.equal(result, null);
  await srv.close();
});

test("queue.stats", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/queue/fila/stats", envelope({ name: "fila", depth: 3 }));

  const result = await clientFor(srv).queue.stats("fila");
  assert.equal(result.depth, 3);
  await srv.close();
});

test("queue.delete", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/queue/fila", envelope({}));

  await clientFor(srv).queue.delete("fila");
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});

// ---- edgedb ----

test("edgedb.list", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/edgedb", envelope({ databases: [{ name: "meubanco", size_bytes: 4096 }] }));

  const result = await clientFor(srv).edgedb.list();
  assert.equal(result[0]?.name, "meubanco");
  await srv.close();
});

test("edgedb.query", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/edgedb/meubanco/query", envelope({ columns: ["id", "nome"], rows: [[1, "Fulano"]] }));

  const result = await clientFor(srv).edgedb.query("meubanco", "SELECT * FROM t");
  assert.equal(result.columns?.length, 2);
  assert.equal(result.rows?.length, 1);
  await srv.close();
});

test("edgedb.delete", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/edgedb/meubanco", envelope({}));

  await clientFor(srv).edgedb.delete("meubanco");
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});

// ---- cron ----

test("cron.create", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/cron/jobs", envelope({ id: "1", name: "job" }));

  const result = await clientFor(srv).cron.create({ name: "job", schedule: "@daily" });
  assert.equal(result.id, "1");
  await srv.close();
});

test("cron.list", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cron/jobs", envelope([{ id: "1", name: "job" }]));

  const jobs = await clientFor(srv).cron.list();
  assert.equal(jobs[0]?.name, "job");
  await srv.close();
});

test("cron.get", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cron/jobs/1", envelope({ id: "1", name: "job" }));

  const result = await clientFor(srv).cron.get("1");
  assert.equal(result.id, "1");
  await srv.close();
});

test("cron.update", async () => {
  const srv = await TestServer.start();
  srv.route("PUT /api/v1/cron/jobs/1", envelope({ id: "1", name: "job-renomeado" }));

  const result = await clientFor(srv).cron.update("1", { name: "job-renomeado" });
  assert.equal(result.name, "job-renomeado");
  await srv.close();
});

test("cron.delete", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/cron/jobs/1", envelope({}));

  await clientFor(srv).cron.delete("1");
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});

test("cron.trigger", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/cron/jobs/1/trigger", envelope({}));

  await clientFor(srv).cron.trigger("1");
  assert.equal(srv.lastRequest?.path, "/api/v1/cron/jobs/1/trigger");
  await srv.close();
});

test("cron.workerStatus", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/cron/worker/status", envelope({ running: true }));

  const result = await clientFor(srv).cron.workerStatus();
  assert.equal(result.running, true);
  await srv.close();
});

test("cron.workerStart", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/cron/worker/start", envelope({}));

  await clientFor(srv).cron.workerStart();
  assert.equal(srv.lastRequest?.path, "/api/v1/cron/worker/start");
  await srv.close();
});

test("cron.workerStop", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/cron/worker/stop", envelope({}));

  await clientFor(srv).cron.workerStop();
  assert.equal(srv.lastRequest?.path, "/api/v1/cron/worker/stop");
  await srv.close();
});

// ---- uptime ----

test("uptime.create", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/uptime/monitors", envelope({ id: "1", url: "https://exemplo.com" }));

  const result = await clientFor(srv).uptime.create("https://exemplo.com");
  assert.equal(result.id, "1");
  await srv.close();
});

test("uptime.list", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/uptime/monitors", envelope([{ id: "1", url: "https://exemplo.com" }]));

  const result = await clientFor(srv).uptime.list();
  assert.equal(result[0]?.id, "1");
  await srv.close();
});

test("uptime.get", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/uptime/monitors/1", envelope({ id: "1", url: "https://exemplo.com" }));

  const result = await clientFor(srv).uptime.get("1");
  assert.equal(result.url, "https://exemplo.com");
  await srv.close();
});

test("uptime.update", async () => {
  const srv = await TestServer.start();
  srv.route("PUT /api/v1/uptime/monitors/1", envelope({ id: "1", interval_sec: 60 }));

  const result = await clientFor(srv).uptime.update("1", { interval_sec: 60 });
  assert.equal(result.interval_sec, 60);
  await srv.close();
});

test("uptime.delete", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/uptime/monitors/1", envelope({}));

  await clientFor(srv).uptime.delete("1");
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});

test("uptime.checks", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/uptime/monitors/1/checks", envelope([{ status: 200 }]));

  const result = await clientFor(srv).uptime.checks("1");
  assert.equal(result[0]?.status, 200);
  await srv.close();
});

test("uptime.workerStatus", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/uptime/worker/status", envelope({ running: true }));

  const result = await clientFor(srv).uptime.workerStatus();
  assert.equal(result.running, true);
  await srv.close();
});

test("uptime.workerStart", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/uptime/worker/start", envelope({}));

  await clientFor(srv).uptime.workerStart();
  assert.equal(srv.lastRequest?.path, "/api/v1/uptime/worker/start");
  await srv.close();
});

test("uptime.workerStop", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/uptime/worker/stop", envelope({}));

  await clientFor(srv).uptime.workerStop();
  assert.equal(srv.lastRequest?.path, "/api/v1/uptime/worker/stop");
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

test("qrcode.pix returns BinaryResponse with the copia-e-cola header", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/qrcode/pix", {
    status: 200,
    body: Buffer.from("\x89PNGfakepixbytes"),
    contentType: "image/png",
    headers: { "X-Pix-Copia-Cola": "00020101021126330014br.gov.bcb.pix...6304ABCD" },
  });

  const result = await clientFor(srv).qrcode.pix({ chave: "11999999999", nome: "Fulano", cidade: "Sao Paulo", valor: 10.5 });
  assert.equal(Buffer.from(result.content).toString(), "\x89PNGfakepixbytes");
  assert.equal(result.contentType, "image/png");
  // Headers is case-insensitive by spec, read it back differently-cased on purpose
  assert.equal(result.headers.get("x-pix-copia-cola"), "00020101021126330014br.gov.bcb.pix...6304ABCD");
  assert.ok(srv.lastRequest?.path.includes("chave=11999999999"));
  assert.ok(srv.lastRequest?.path.includes("valor=10.5"));
  await srv.close();
});

test("imagem.transform returns BinaryResponse", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/imagem/transform", { status: 200, body: Buffer.from("fakejpegbytes"), contentType: "image/jpeg" });

  const result = await clientFor(srv).imagem.transform({ url: "https://exemplo.com/foto.jpg" }, { resize: "800x600" });
  assert.equal(result.contentType, "image/jpeg");
  assert.ok(srv.lastRequest?.path.includes("resize=800x600"));
  await srv.close();
});

test("imagem.analyze", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/imagem/analyze", envelope({ width: 800, height: 600, format: "jpeg", dominant_color: "#336699", palette: [], blurhash: "abc" }));

  const result = await clientFor(srv).imagem.analyze({ url: "https://exemplo.com/foto.jpg" });
  assert.equal(result.width, 800);
  await srv.close();
});

test("templating.invoice returns BinaryResponse", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/templating/invoice", { status: 200, body: Buffer.from("%PDF-fake"), contentType: "application/pdf" });

  const result = await clientFor(srv).templating.invoice({
    issuer: { name: "Minha Empresa" },
    recipient: { name: "Cliente Exemplo" },
    items: [{ description: "Consultoria", quantity: 2, unit_price: 500 }],
  });
  assert.equal(result.contentType, "application/pdf");
  await srv.close();
});

// ---- functions (compute) ----

test("functions.list", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/functions", envelope({ functions: [{ name: "minha", size_bytes: 2048 }] }));

  const result = await clientFor(srv).functions.list();
  assert.equal(result[0]?.name, "minha");
  await srv.close();
});

test("functions.get", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/functions/minha", envelope({ name: "minha", size_bytes: 2048 }));

  const result = await clientFor(srv).functions.get("minha");
  assert.equal(result.size_bytes, 2048);
  await srv.close();
});

test("functions.deploy", async () => {
  const srv = await TestServer.start();
  srv.route("PUT /api/v1/functions/minha", envelope({ name: "minha", size_bytes: 4096 }));

  const result = await clientFor(srv).functions.deploy("minha", new Uint8Array([0, 97, 115, 109]));
  assert.equal(result.name, "minha");
  await srv.close();
});

test("functions.delete", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/functions/minha", envelope({}));

  await clientFor(srv).functions.delete("minha");
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});

test("functions.invoke returns BinaryResponse", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/functions/echo/invoke", { status: 200, body: "ola de volta", contentType: "text/plain" });

  const result = await clientFor(srv).functions.invoke("echo", "ola");
  assert.equal(Buffer.from(result.content).toString(), "ola de volta");
  await srv.close();
});

// ---- auth ----

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

test("auth.login stores token on client", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/user/login", envelope({ token: "login-token" }));

  const client = clientFor(srv);
  const token = await client.auth.login("voce", "senha1234");
  assert.equal(token, "login-token");
  assert.equal(client.apiKey, "login-token");
  await srv.close();
});

test("auth.me", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/user/me", envelope({ id: 1, username: "voce", email: "voce@exemplo.com", role: "user" }));

  const result = await clientFor(srv).auth.me();
  assert.equal(result.username, "voce");
  await srv.close();
});

test("auth.deleteAccount", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/user/me", envelope({}));

  await clientFor(srv).auth.deleteAccount();
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});

// ---- account ----

test("account.usage", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/account/usage", envelope([{ api: "cep", operation: "lookup", request_count: 42 }]));

  const rows = await clientFor(srv).account.usage(7);
  assert.equal(rows[0]?.request_count, 42);
  assert.ok(srv.lastRequest?.path.includes("days=7"));
  await srv.close();
});

test("account.changePassword", async () => {
  const srv = await TestServer.start();
  srv.route("POST /api/v1/account/password", envelope({}));

  await clientFor(srv).account.changePassword("senha-antiga", "senha-nova");
  assert.ok(srv.lastRequest?.body.includes("senha-nova"));
  await srv.close();
});

test("account.apiKeys.list", async () => {
  const srv = await TestServer.start();
  srv.route("GET /api/v1/account/apikeys", envelope([{ id: 1, name: "ci", active: true }]));

  const result = await clientFor(srv).account.apiKeys.list();
  assert.equal(result[0]?.name, "ci");
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

test("account.apiKeys.revoke", async () => {
  const srv = await TestServer.start();
  srv.route("DELETE /api/v1/account/apikeys/1", envelope({}));

  await clientFor(srv).account.apiKeys.revoke(1);
  assert.equal(srv.lastRequest?.method, "DELETE");
  await srv.close();
});
