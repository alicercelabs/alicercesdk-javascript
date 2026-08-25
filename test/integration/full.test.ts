/**
 * Real integration test: talks to an actual running AlicerceLabs
 * instance (production by default) over the network, using the public
 * SDK exactly as a real caller would. Opt-in — set
 * ALICERCELABS_INTEGRATION=1 — because it registers and deletes a real
 * throwaway account, creates and deletes real resources (KV keys, a
 * queue, an Edge DB, a cron job, an uptime monitor, a deployed function,
 * an API key), and makes real outbound calls the unit suite has no
 * business making.
 *
 *   ALICERCELABS_INTEGRATION=1 npm run test:integration
 *
 * Override ALICERCELABS_API_BASE / ALICERCELABS_ACCOUNT_BASE to point at
 * a self-hosted instance instead of production.
 *
 * Deliberately NOT covered: cron.workerStart/workerStop and
 * uptime.workerStart/workerStop. Those control a daemon shared by every
 * account on the instance, not something scoped to the test account —
 * stopping it here would affect real users. workerStatus (read-only) is
 * covered instead.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AlicerceLabs } from "../../src/index";

const RUN = process.env.ALICERCELABS_INTEGRATION === "1";

/** Compiles a tiny WASI guest that echoes the request body back, so
 * functions.invoke has something real to call. Returns null (the caller
 * skips that one assertion, not the whole suite) if `go` isn't on PATH —
 * a plain `npm test` shouldn't need a Go toolchain, but the integration
 * suite, run deliberately and with network access anyway, can expect it. */
function buildEchoWASM(): Buffer | null {
  try {
    execFileSync("go", ["version"], { stdio: "ignore" });
  } catch {
    return null;
  }

  const dir = mkdtempSync(join(tmpdir(), "alicercelabs-it-"));
  const src = `package main

import (
	"encoding/json"
	"io"
	"os"
)

type req struct {
	Body string \`json:"body"\`
}
type resp struct {
	Status int    \`json:"status"\`
	Body   string \`json:"body"\`
}

func main() {
	data, _ := io.ReadAll(os.Stdin)
	var r req
	json.Unmarshal(data, &r)
	out, _ := json.Marshal(resp{Status: 200, Body: "eco: " + r.Body})
	os.Stdout.Write(out)
}
`;
  const srcPath = join(dir, "main.go");
  writeFileSync(srcPath, src);
  const wasmPath = join(dir, "echo.wasm");
  execFileSync("go", ["build", "-o", wasmPath, srcPath], {
    env: { ...process.env, GOOS: "wasip1", GOARCH: "wasm" },
  });
  return readFileSync(wasmPath);
}

test("integration: full API surface against a real instance", { skip: !RUN }, async (t) => {
  const apiBase = process.env.ALICERCELABS_API_BASE || "https://api.alicercelabs.com.br";
  const accountBase = process.env.ALICERCELABS_ACCOUNT_BASE || "https://app.alicercelabs.com.br";

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `sdk-js-it-${suffix}`;
  const email = `${username}@mailinator.com`;
  const password = `Senha-Forte-${suffix}!`;

  const client = new AlicerceLabs({ apiBase, accountBase });

  await client.auth.register(username, email, password);
  t.after(async () => {
    try {
      await client.auth.deleteAccount();
    } catch (err) {
      console.error("cleanup: auth.deleteAccount failed:", err);
    }
  });

  await t.test("auth", async () => {
    const me = await client.auth.me();
    assert.equal(me.username, username);
  });

  await t.test("ip", async () => {
    await client.ip.lookup("8.8.8.8");
    await client.ip.self();
  });

  await t.test("cep", async () => {
    const endereco = await client.cep.get("01310100");
    // municipio (not "cidade") is the field the API actually returns —
    // asserting on it here is what caught the wrong field name before
    // this suite existed.
    assert.equal(endereco.municipio, "São Paulo");

    await client.cep.search("SP", "São Paulo", "Avenida Paulista");
    await client.cep.cities("SP");
    await client.cep.neighborhoods("SP", "São Paulo");
    // Same pair as the CEP docs page's own ?rota=true example — known to
    // geocode on both ends.
    await client.cep.distance("01310100", "20040020");

    const bulk = await client.cep.bulk(["01310100"]);
    assert.equal(bulk[0]?.endereco?.municipio, "São Paulo");
  });

  await t.test("dns", async () => {
    await client.dns.lookup("alicercelabs.com.br");
  });

  await t.test("email", async () => {
    await client.email.verify(email);
  });

  await t.test("ssl", async () => {
    await client.ssl.check("alicercelabs.com.br");
  });

  await t.test("maps", async () => {
    await client.maps.geocode("Avenida Paulista, 1000, São Paulo");
    await client.maps.reverse(-23.5613, -46.6558);
    await client.maps.route("-23.5613,-46.6558", "-23.5505,-46.6333");
  });

  await t.test("trust", async () => {
    await client.trust.check("alicercelabs.com.br");
  });

  await t.test("kv", async () => {
    const key = `sdk-integration-${suffix}`;
    await client.kv.put(key, "valor-de-teste", 300);
    try {
      assert.equal(await client.kv.get(key), "valor-de-teste");
      await client.kv.list();
    } finally {
      await client.kv.delete(key);
    }
  });

  await t.test("queue", async () => {
    const name = `sdk-integration-${suffix}`;
    try {
      await client.queue.push(name, "mensagem de teste");
      await client.queue.stats(name);
      const message = await client.queue.pull(name);
      assert.equal(message, "mensagem de teste");
    } finally {
      await client.queue.delete(name);
    }
  });

  await t.test("edgedb", async () => {
    const name = `sdk-integration-${suffix}`;
    try {
      await client.edgedb.query(name, "CREATE TABLE t (id INTEGER PRIMARY KEY, nome TEXT)");
      await client.edgedb.query(name, "INSERT INTO t (nome) VALUES (?)", ["Fulano"]);
      const result = await client.edgedb.query(name, "SELECT * FROM t");
      assert.equal(result.rows?.length, 1);
      await client.edgedb.list();
    } finally {
      await client.edgedb.delete(name);
    }
  });

  await t.test("cron", async () => {
    const job = await client.cron.create({
      name: `sdk-integration-${suffix}`,
      schedule: "0 0 1 1 *",
      image_type: "image",
      image_source: "alpine:latest",
      command: "echo oi",
    });
    const id = String(job.id);
    try {
      await client.cron.list();
      await client.cron.get(id);
      // Update is PUT semantics (whole-resource replace), not a partial
      // patch — every required field has to be present.
      await client.cron.update(id, {
        name: `sdk-integration-${suffix}`,
        schedule: "0 0 2 1 *",
        image_type: "image",
        image_source: "alpine:latest",
        command: "echo oi",
      });
      // Not calling trigger(): it would actually run the job's command.
      await client.cron.workerStatus();
    } finally {
      await client.cron.delete(id);
    }
  });

  await t.test("uptime", async () => {
    const monitor = await client.uptime.create("https://alicercelabs.com.br", {
      name: `sdk-integration-${suffix}`,
    });
    const id = String(monitor.id);
    try {
      await client.uptime.list();
      await client.uptime.get(id);
      // Same PUT-is-whole-resource-replace deal as cron.update.
      await client.uptime.update(id, {
        name: `sdk-integration-${suffix}`,
        url: "https://alicercelabs.com.br",
        interval_sec: 300,
      });
      await client.uptime.checks(id);
      await client.uptime.workerStatus();
    } finally {
      await client.uptime.delete(id);
    }
  });

  await t.test("qrcode", async () => {
    const result = await client.qrcode.generate("https://alicercelabs.com.br", 256);
    assert.ok(result.content.length > 0);

    const pix = await client.qrcode.pix({ chave: "11999999999", nome: "Fulano", cidade: "Sao Paulo", valor: 10.5 });
    assert.ok(pix.content.length > 0);
    assert.ok(pix.headers.get("x-pix-copia-cola")?.includes("br.gov.bcb.pix"));
  });

  await t.test("imagem", async () => {
    // Reuse the QR code we just generated instead of depending on an
    // external image URL staying up — self-contained and just as real.
    const png = (await client.qrcode.generate("https://alicercelabs.com.br", 256)).content;
    await client.imagem.transform({ image: png }, { grayscale: true });
    await client.imagem.analyze({ image: png });
  });

  await t.test("templating", async () => {
    const result = await client.templating.invoice({
      issuer: { name: "SDK Integration Test" },
      recipient: { name: "Cliente Exemplo" },
      items: [{ description: "Teste", quantity: 1, unit_price: 1 }],
    });
    assert.equal(result.contentType, "application/pdf");
  });

  await t.test("functions", async (t) => {
    const wasm = buildEchoWASM();
    if (!wasm) {
      t.skip("go toolchain not on PATH, can't build the WASI test fixture");
      return;
    }
    const name = `sdk-integration-${suffix}`;
    try {
      await client.functions.deploy(name, wasm);
      await client.functions.list();
      await client.functions.get(name);
      const result = await client.functions.invoke(name, "ola");
      assert.equal(Buffer.from(result.content).toString(), "eco: ola");
    } finally {
      await client.functions.delete(name);
    }
  });

  await t.test("account", async () => {
    const created = await client.account.apiKeys.create(`sdk-integration-${suffix}`);
    try {
      await client.account.apiKeys.list();
      await client.account.usage(7);
      await client.account.changePassword(password, password + "-novo");
    } finally {
      await client.account.apiKeys.revoke(created.api_key.id);
    }
  });
});
