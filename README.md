# alicercelabs (JavaScript/TypeScript)

[![CI](https://github.com/alicercelabs/alicercesdk-javascript/actions/workflows/ci.yml/badge.svg)](https://github.com/alicercelabs/alicercesdk-javascript/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/alicercelabs/alicercesdk-javascript/main/.github/badges/coverage.json)](https://github.com/alicercelabs/alicercesdk-javascript/actions/workflows/ci.yml)

SDK oficial em TypeScript para a [AlicerceLabs](https://alicercelabs.com.br): IP, CEP, DNS, email, filas, banco de dados edge, execução de WASM e o resto das 16 APIs, todas atrás do mesmo formato de resposta. As de consulta pura (IP, CEP, DNS, email, SSL, confiabilidade, mapas, QR code, imagem, fatura) respondem sem nenhuma credencial: `new AlicerceLabs()` sem `apiKey` já funciona, numa cota menor. Pra cota maior nessas, ou pra usar as que guardam dado seu (chave-valor, fila, banco edge, funções, cron, uptime, que sempre exigem um token), é só registrar, ver "Sem chave ainda?" abaixo.

Zero dependências de runtime. Usa o `fetch` nativo do Node 18+ (ou do navegador).

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

Sem chave ainda? Nas APIs de consulta pura, `new AlicerceLabs()` sem `apiKey` já funciona sem mais nada, numa cota menor por IP (100/dia em vez de 1.000/dia). Se quiser a cota maior, ou uma das APIs que guardam dado seu (KV, Queue, EdgeDB, Functions, Cron, UpTime, essas sempre exigem token), `register`/`login` guardam o token no client sozinhos:

```ts
const client = new AlicerceLabs();
await client.auth.register("voce", "voce@exemplo.com", "alguma-coisa-forte");
await client.cep.get("01310100"); // já autenticado
```

## O que tem aqui

Uma propriedade por API, todas no mesmo client:

| Propriedade | API |
|---|---|
| `client.ip` | IP Intelligence — geo, ASN, cloud, VPN/Tor (`lookup`/`self`/`batch`) |
| `client.cep` | Endereço a partir do CEP |
| `client.cnpj` | Consulta de CNPJ (fonte local + fallback BrasilAPI) |
| `client.cpf` | Validação de CPF e região fiscal |
| `client.feriados` | Feriados nacionais por ano |
| `client.diasUteis` | Contagem de dias úteis num intervalo |
| `client.isbn` | Metadados de livro por ISBN |
| `client.ibge` | Regiões, estados, municípios e classes CNAE |
| `client.bancos` | Lista de bancos (participantes do STR) |
| `client.ncm` | Nomenclatura Comum do Mercosul |
| `client.oms` | CID-10 |
| `client.cambio` | Cotação de câmbio (PTAX) |
| `client.taxas` | Taxas e índices oficiais (Selic, CDI, IPCA, IGP-M) |
| `client.registroBR` | Disponibilidade de domínio .br |
| `client.pix` | Participantes do PIX |
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

Cada parâmetro e cada campo de resposta está documentado em [alicercelabs.com.br](https://alicercelabs.com.br).

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
console.log(nova.key); // só aparece aqui, salve agora

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

**Endpoints que devolvem arquivo** (QRCode, Imagem, Templating, Functions `invoke`) devolvem um `BinaryResponse`, não o envelope JSON de sempre:

```ts
const qr = await client.qrcode.generate("https://alicercelabs.com.br", 512);
await qr.save("qrcode.png"); // Node.js

const pix = await client.qrcode.pix({ chave: "11999999999", nome: "Fulano de Tal", cidade: "Sao Paulo", valor: 10.5 });
await pix.save("pix.png");
console.log(pix.headers.get("x-pix-copia-cola")); // o mesmo payload em texto, pro "copia e cola"

const fatura = await client.templating.invoice({
  issuer: { name: "Minha Empresa" },
  recipient: { name: "Cliente Exemplo" },
  items: [{ description: "Consultoria", quantity: 2, unit_price: 500 }],
});
await fatura.save("fatura.pdf");
```

**Functions** (WASM, qualquer linguagem que compile pra WASI, incluindo Go puro):

```ts
import { readFile } from "node:fs/promises";

const wasm = await readFile("minha_funcao.wasm");
await client.functions.deploy("minha", wasm);

const resposta = await client.functions.invoke("minha", "algum corpo");
console.log(Buffer.from(resposta.content).toString());
```

## Erros

Toda chamada com falha lança uma exceção tipada por status HTTP. Todas herdam de `AlicerceLabsError`:

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
  accountBase: "https://app.alicercelabs.com.br",  // padrão, usado só por client.account.*
  timeoutMs: 30000,
});
```

`accountBase` existe separado de `apiBase` porque API keys e analytics de uso vivem no backend do painel, não no host das APIs de produto. Você não precisa pensar nisso no dia a dia, o SDK já manda cada chamada pro host certo.

## Desenvolvimento

```bash
npm install
npm run build            # compila src/ -> dist/ (CommonJS + .d.ts)
npm test                 # roda os testes com o test runner nativo do Node
npm run test:coverage    # idem, com relatório de cobertura (~99% de linhas)
```

Os testes sobem um servidor HTTP real (`node:http`, não um mock de `fetch`) e batem nele, um teste por método de API. É o mesmo servidor de teste que a suíte usa pra validar autenticação, encoding de query params e mapeamento de erro.

### Testes de integração

`test/integration/full.test.ts` bate numa instância real da AlicerceLabs (produção por padrão), usando a mesma API pública que qualquer chamador usaria. Ele registra uma conta descartável de verdade, cria e apaga recursos de verdade (chaves KV, uma fila, um Edge DB, um job de cron, um monitor de uptime, uma função, uma API key) e no fim apaga a própria conta. Por isso é opt-in:

```bash
ALICERCELABS_INTEGRATION=1 npm run test:integration
```

`ALICERCELABS_API_BASE`/`ALICERCELABS_ACCOUNT_BASE` apontam pra uma instância self-hosted em vez de produção, se for o caso. No CI, esse workflow (`integration.yml`) só roda manualmente (`workflow_dispatch`), nunca em todo push.

Não testado de propósito: `cron.workerStart`/`workerStop` e `uptime.workerStart`/`workerStop`. Esses controlam um daemon compartilhado por toda a instância, não algo isolado à conta de teste, então pará-lo aqui afetaria usuários de verdade. `workerStatus` (só leitura) é testado no lugar deles.

## Licença

MIT
