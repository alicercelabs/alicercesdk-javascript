/**
 * Official JavaScript/TypeScript SDK for AlicerceLabs
 * (https://alicercelabs.com.br).
 *
 *   import { AlicerceLabs } from "alicercelabs";
 *
 *   const client = new AlicerceLabs({ apiKey: "alk_..." });
 *   const endereco = await client.cep.get("01310100");
 *   console.log(endereco.logradouro); // "Avenida Paulista"
 *
 * Every product API is available as a property on the client —
 * `client.ip`, `client.cep`, `client.cnpj`, `client.cpf`,
 * `client.feriados`, `client.diasUteis`, `client.isbn`, `client.ibge`,
 * `client.dns`, `client.email`, `client.cron`, `client.qrcode`,
 * `client.ssl`, `client.kv`, `client.uptime`, `client.imagem`,
 * `client.maps`, `client.queue`, `client.templating`, `client.edgedb`,
 * `client.functions`, `client.trust` — plus account
 * management under `client.auth` (register/login/profile) and
 * `client.account` (API keys, usage analytics).
 *
 * No token yet? `client.auth.register(...)` or `client.auth.login(...)`
 * both store the resulting token on the client automatically.
 */

import { BaseClient, ClientOptions, BinaryResponse } from "./client";
import { IPResource, CEPResource, CNPJResource, CPFResource, FeriadosResource, DiasUteisResource, ISBNResource, IBGEResource, DNSResource, EmailResource, SSLResource, MapsResource, TrustResource } from "./resources/lookups";
import { KVResource, QueueResource, EdgeDBResource } from "./resources/storage";
import { CronResource, UpTimeResource } from "./resources/jobs";
import { QRCodeResource, ImagemResource, TemplatingResource } from "./resources/media";
import { FunctionsResource } from "./resources/compute";
import { AuthResource, AccountResource } from "./resources/account";

export * from "./errors";
export { BinaryResponse, ClientOptions } from "./client";
export * from "./resources/lookups";
export * from "./resources/storage";
export * from "./resources/jobs";
export * from "./resources/media";
export * from "./resources/compute";
export * from "./resources/account";

export class AlicerceLabs {
  /** @internal */
  readonly client: BaseClient;

  readonly ip: IPResource;
  readonly cep: CEPResource;
  readonly cnpj: CNPJResource;
  readonly cpf: CPFResource;
  readonly feriados: FeriadosResource;
  readonly diasUteis: DiasUteisResource;
  readonly isbn: ISBNResource;
  readonly ibge: IBGEResource;
  readonly dns: DNSResource;
  readonly email: EmailResource;
  readonly ssl: SSLResource;
  readonly maps: MapsResource;
  readonly trust: TrustResource;

  readonly kv: KVResource;
  readonly queue: QueueResource;
  readonly edgedb: EdgeDBResource;

  readonly cron: CronResource;
  readonly uptime: UpTimeResource;

  readonly qrcode: QRCodeResource;
  readonly imagem: ImagemResource;
  readonly templating: TemplatingResource;

  readonly functions: FunctionsResource;

  readonly auth: AuthResource;
  readonly account: AccountResource;

  constructor(options: ClientOptions = {}) {
    this.client = new BaseClient(options);

    this.ip = new IPResource(this.client);
    this.cep = new CEPResource(this.client);
    this.cnpj = new CNPJResource(this.client);
    this.cpf = new CPFResource(this.client);
    this.feriados = new FeriadosResource(this.client);
    this.diasUteis = new DiasUteisResource(this.client);
    this.isbn = new ISBNResource(this.client);
    this.ibge = new IBGEResource(this.client);
    this.dns = new DNSResource(this.client);
    this.email = new EmailResource(this.client);
    this.ssl = new SSLResource(this.client);
    this.maps = new MapsResource(this.client);
    this.trust = new TrustResource(this.client);

    this.kv = new KVResource(this.client);
    this.queue = new QueueResource(this.client);
    this.edgedb = new EdgeDBResource(this.client);

    this.cron = new CronResource(this.client);
    this.uptime = new UpTimeResource(this.client);

    this.qrcode = new QRCodeResource(this.client);
    this.imagem = new ImagemResource(this.client);
    this.templating = new TemplatingResource(this.client);

    this.functions = new FunctionsResource(this.client);

    this.auth = new AuthResource(this.client);
    this.account = new AccountResource(this.client);
  }

  /** The API key/token currently in use — set this after a manual login,
   * or read it to persist the token from `auth.register()`/`login()`. */
  get apiKey(): string | undefined {
    return this.client.apiKey;
  }

  set apiKey(value: string | undefined) {
    this.client.apiKey = value;
  }
}

export default AlicerceLabs;
