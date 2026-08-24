# alicercelabs (JavaScript/TypeScript)

SDK oficial em TypeScript para a [AlicerceLabs](https://alicercelabs.com.br) — infra básica de API pra quem constrói no Brasil (IP, CEP, DNS, email, filas, banco de dados edge, execução de WASM e mais, todas atrás de uma autenticação e um formato de resposta só).

Zero dependências de runtime — usa o `fetch` nativo do Node 18+ (ou do navegador).

```bash
npm install github:alicercelabs/alicercesdk-javascript
```

## Início rápido

```ts
import { AlicerceLabs } from "alicercelabs";

const client = new AlicerceLabs({ apiKey: "alk_..." }); // ou um token JWT de login/register

const endereco = await client.cep.get("01310100");
console.log(endereco.logradouro); // "Avenida Paulista"
```

Ainda não tem uma chave? `register`/`login` guardam o token no client sozinhos:

```ts
const client = new AlicerceLabs();
await client.auth.register("voce", "voce@exemplo.com", "alguma-coisa-forte");
await client.cep.get("01310100"); // já autenticado
```

## O que tem aqui

Uma propriedade por API, todas no mesmo client:

| Propriedade | API |
|---|---|
| `client.ip` | Geolocalização de IP |
| `client.cep` | Endereço a partir do CEP |
| `client.dns` | Consulta DNS |
| `client.email` | Verificação de email |
| `client.ssl` | Checagem de certificado |
| `client.maps` | Geocodificação e rotas |
| `client.trust` | Score de confiabilidade |
| `client.kv` | Armazenamento chave-valor |
| `client.queue` | Filas FIFO |
| `client.edgedb` | Banco de dados edge (SQLite por cliente) |
| `client.cron` | Jobs agendados |
| `client.uptime` | Monitoramento de uptime |
| `client.qrcode` | Gerador de QR Code |
| `client.imagem` | Transformação de imagem |
| `client.templating` | Geração de fatura em PDF |
| `client.functions` | Execução de WASM |
| `client.auth` | Registro, login, perfil |
| `client.account` | Suas próprias API keys e analytics de uso |

Documentação completa de cada API, com todos os parâmetros: [alicercelabs.com.br](https://alicercelabs.com.br).

## Exemplos

**Ver seus próprios dados de conta e uso:**

```ts
const me = await client.auth.me();
console.log(me.username, me.email);

const uso = await client.account.usage(7); // últimos 7 dias
for (const linha of uso) {
  console.log(linha.api, linha.operation, linha.request_count);
}
```

**Gerenciar API keys:**

```ts
const nova = await client.account.apiKeys.create("ci-pipeline");
console.log(nova.key); // só aparece aqui — salve agora

const keys = await client.account.apiKeys.list();
keys.forEach((k) => console.log(k.name, k.active));
```

**KV, Queue, Edge DB:**

```ts
await client.kv.put("tema", "escuro", 3600);
await client.kv.get("tema"); // "escuro"

await client.queue.push("pedidos", "pedido-123");
await client.queue.pull("pedidos", 3); // long-poll de até 3s

await client.edgedb.query("meubanco", "CREATE TABLE t (id INTEGER PRIMARY KEY, nome TEXT)");
await client.edgedb.query("meubanco", "INSERT INTO t (nome) VALUES (?)", ["Fulano"]);
const resultado = await client.edgedb.query("meubanco", "SELECT * FROM t");
console.log(resultado.rows);
```

**Endpoints que devolvem arquivo** (QRCode, Imagem, Templating, Functions `invoke`) devolvem um `BinaryResponse`:

```ts
const qr = await client.qrcode.generate("https://alicercelabs.com.br", 512);
await qr.save("qrcode.png"); // Node.js

const fatura = await client.templating.invoice({
  issuer: { name: "Minha Empresa" },
  recipient: { name: "Cliente Exemplo" },
  items: [{ description: "Consultoria", quantity: 2, unit_price: 500 }],
});
await fatura.save("fatura.pdf");
```

**Functions** (WASM, qualquer linguagem que compile pra WASI — incluindo Go puro):

```ts
import { readFile } from "node:fs/promises";

const wasm = await readFile("minha_funcao.wasm");
await client.functions.deploy("minha", wasm);

const resposta = await client.functions.invoke("minha", "algum corpo");
console.log(Buffer.from(resposta.content).toString());
```

## Erros

Toda chamada com falha lança uma exceção tipada por status HTTP — todas herdam de `AlicerceLabsError`:

```ts
import { AlicerceLabsError, NotFoundError, RateLimitError } from "alicercelabs";

try {
  await client.kv.get("chave-que-nao-existe");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("não achou");
  } else if (err instanceof RateLimitError) {
    console.log(`espera ${err.retryAfter}s`);
  } else if (err instanceof AlicerceLabsError) {
    console.log(`erro ${err.statusCode}: ${err.message}`);
  }
}
```

| Exceção | Status |
|---|---|
| `ValidationError` | 400 |
| `AuthenticationError` | 401 |
| `NotFoundError` | 404 |
| `RateLimitError` | 429 (tem `.retryAfter`, em segundos) |
| `ServiceUnavailableError` | 503 |
| `ServerError` | qualquer outro 5xx |

## Configuração avançada

```ts
const client = new AlicerceLabs({
  apiKey: "alk_...",
  apiBase: "https://api.alicercelabs.com.br",      // padrão
  accountBase: "https://app.alicercelabs.com.br",  // padrão — usado só por client.account.*
  timeoutMs: 30000,
});
```

## Desenvolvimento

```bash
npm install
npm run build   # compila src/ -> dist/ (CommonJS + .d.ts)
npm test        # roda os testes com o test runner nativo do Node
```

## Licença

MIT
