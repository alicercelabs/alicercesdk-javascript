/**
 * IP, CEP, DNS, Email, SSL, Maps, Trust — the read-only lookup APIs. See
 * https://alicercelabs.com.br/apis/{ip,cep,dns,email,ssl,maps,trust} for
 * the exact field names each one returns.
 */

import type { BaseClient } from "../client";

export interface IPContinent {
  code: string;
  name: string;
}

export interface IPCountry {
  code: string;
  name: string;
  is_eu: boolean;
}

export interface IPRegion {
  code: string;
  name: string;
}

export interface IPLocation {
  continent: IPContinent | null;
  country: IPCountry | null;
  region: IPRegion | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_radius_km: number | null;
  geoname_id: number | null;
  timezone: string | null;
}

export interface IPCloud {
  provider: string;
  service: string | null;
  region: string | null;
}

export interface IPRPKI {
  status: "valid" | "invalid" | "not_found" | "unknown";
  origin_asn: number | null;
  prefix: string | null;
}

export interface IPNetwork {
  cidr: string | null;
  /** A real number, never a composed "AS<n>" string. */
  asn: number | null;
  asn_name: string | null;
  asn_domain: string | null;
  organization: string | null;
  isp: string | null;
  rir: string | null;
  type: "isp" | "hosting" | "business" | "education" | "government" | "banking" | "cdn" | "mobile" | "satellite" | "unknown";
  cloud: IPCloud | null;
  rpki: IPRPKI | null;
}

type IPConfidenceLevel = "high" | "medium" | "low" | "unknown";

export interface IPVPN {
  detected: boolean;
  provider: string | null;
  confidence: IPConfidenceLevel;
  last_seen: string | null;
}

export interface IPProxy {
  detected: boolean;
  type: string | null;
  confidence: IPConfidenceLevel;
  last_seen: string | null;
}

export interface IPTor {
  detected: boolean;
  exit_node: boolean | null;
}

export interface IPRelay {
  detected: boolean;
  provider: string | null;
}

export interface IPResidentialProxy {
  detected: boolean;
  provider: string | null;
  confidence: IPConfidenceLevel;
}

/** Detected is always known (never null): "checked, not detected" is
 * itself informative. */
export interface IPPrivacy {
  anonymous: boolean | null;
  vpn: IPVPN;
  proxy: IPProxy;
  tor: IPTor;
  relay: IPRelay;
  residential_proxy: IPResidentialProxy;
}

export interface IPTraits {
  hosting: boolean | null;
  datacenter: boolean | null;
  mobile: boolean | null;
  satellite: boolean | null;
  crawler: boolean | null;
  /** True for non-public scopes — always known, never null. */
  bogon: boolean;
}


export interface IPConfidenceSummary {
  country: IPConfidenceLevel;
  region: IPConfidenceLevel;
  city: IPConfidenceLevel;
  network: IPConfidenceLevel;
  privacy: IPConfidenceLevel;
}

export interface IPMeta {
  updated_at: string;
  confidence: IPConfidenceSummary;
  /** Only present with includeSourceDetails. */
  sources?: Record<string, string[]>;
}

export interface IPResult {
  ip: string;
  /** 4 or 6. */
  version: number;
  scope: "public" | "private" | "loopback" | "link_local" | "multicast" | "unspecified" | "documentation" | "benchmark" | "reserved" | "carrier_grade_nat";
  routable: boolean;
  /** Reverse DNS — null unless includeSourceDetails/hostname was requested. */
  hostname: string | null;

  /** Null for non-routable scopes, or if no geo source had data. */
  location: IPLocation | null;
  network: IPNetwork | null;
  privacy: IPPrivacy;
  traits: IPTraits;

  meta: IPMeta;
}

export interface IPLookupOptions {
  /** Restricts the response to these dot-notation paths (e.g.
   * `["location.country", "network.asn"]`) — `ip` is always kept. */
  fields?: string[];
  /** Adds `meta.sources` (which provider/dataset answered each category). */
  includeSourceDetails?: boolean;
  /** Language for geographic names only (continent/country/region/city) —
   * e.g. `"pt-BR"`. Omitted uses the API default (en). */
  lang?: string;
}

export interface IPBatchError {
  code: string;
  message: string;
}

export interface IPBatchItem {
  ip: string;
  success: boolean;
  data?: IPResult;
  error?: IPBatchError;
}

function ipQuery(options: IPLookupOptions) {
  return {
    fields: options.fields?.length ? options.fields.join(",") : undefined,
    include: options.includeSourceDetails ? "source_details" : undefined,
    lang: options.lang,
  };
}

export class IPResource {
  constructor(private client: BaseClient) {}

  /** Resolves a specific public IPv4/IPv6 address. A private/reserved
   * address isn't an error — it comes back as a partial profile
   * (`scope`/`routable` set, the rest null). */
  lookup(ip: string, options: IPLookupOptions = {}): Promise<IPResult> {
    return this.client.request("GET", `/api/v1/ip/${ip}`, { query: ipQuery(options) });
  }

  /** Resolves the caller — the IP the request itself came from. */
  self(options: IPLookupOptions = {}): Promise<IPResult> {
    return this.client.request("GET", "/api/v1/ip/self", { query: ipQuery(options) });
  }

  /** Resolves up to 100 IPs in one call. Each address is resolved
   * independently — one malformed entry never fails the whole batch, it
   * just gets `success: false` in its own slot. */
  async batch(ips: string[], options: IPLookupOptions = {}): Promise<IPBatchItem[]> {
    const { results } = await this.client.request<{ results: IPBatchItem[] }>(
      "POST",
      "/api/v1/ip/batch",
      { json: { ips }, query: ipQuery(options) },
    );
    return results;
  }
}

export interface CNPJCNAE {
  codigo: number;
  descricao: string;
}

export interface CNPJEndereco {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  municipio?: string;
  codigo_municipio_ibge?: number;
  uf?: string;
}

/** cpf_cnpj_mascarado already comes masked from the API (***XXXXXX**),
 * never plaintext. */
export interface CNPJSocio {
  nome: string;
  qualificacao: string;
  data_entrada?: string;
  cpf_cnpj_mascarado?: string;
  faixa_etaria?: string;
}

/** Field names match the API's own (Portuguese, same layout the Federal
 * Revenue itself uses), not a translated set. `meta.fonte` says which
 * source answered ("local" or "brasilapi") — see the CNPJ API docs for
 * why there are two. */
export interface CNPJResult {
  cnpj: string;
  matriz: boolean;
  razao_social: string;
  nome_fantasia?: string;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral?: string;
  motivo_situacao_cadastral?: number;
  descricao_motivo_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  codigo_natureza_juridica?: number;
  porte?: string;
  capital_social: number;
  cnae_fiscal: CNPJCNAE;
  cnaes_secundarios?: CNPJCNAE[];
  endereco: CNPJEndereco;
  telefone?: string;
  email?: string;
  opcao_pelo_simples: boolean | null;
  opcao_pelo_mei: boolean | null;
  qsa?: CNPJSocio[];
  meta: { fonte: "local" | "brasilapi" };
}

export class CNPJResource {
  constructor(private client: BaseClient) {}

  /** Looks up a company by CNPJ, with or without punctuation
   * ("33683111000280" or "33.683.111/0002-80"). */
  get(cnpj: string): Promise<CNPJResult> {
    return this.client.request("GET", `/api/v1/cnpj/${cnpj}`);
  }
}

/** Municipio (not "cidade") is the field name the API itself uses — the
 * query param on search()/neighborhoods() is called cidade, but the
 * response field isn't. */
export interface CEPResult {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  municipio_cod_ibge?: number;
  uf: string;
  nome?: string;
  ddd?: string;
}

export interface CEPDistance {
  distance_km: number;
  duration_min?: number;
}

export interface CEPBulkResult {
  cep: string;
  endereco?: CEPResult;
  erro?: string;
}

export class CEPResource {
  constructor(private client: BaseClient) {}

  /** Looks up an address by CEP (Brazilian postal code). `rota` isn't a
   * valid option here — that query param only does anything on
   * distance(); GET /cep/{cep} ignores it. */
  get(cep: string, options: { ddd?: boolean } = {}): Promise<CEPResult> {
    return this.client.request("GET", `/api/v1/cep/${cep}`, { query: options });
  }

  /** Reverse lookup: street name -> CEPs, when you don't have the code
   * yet. */
  search(uf: string, cidade: string, logradouro: string): Promise<CEPResult[]> {
    return this.client.request("GET", "/api/v1/cep/busca", { query: { uf, cidade, logradouro } });
  }

  /** Every city AlicerceLabs has CEP data for in a given state. */
  cities(uf: string): Promise<string[]> {
    return this.client.request("GET", "/api/v1/cep/cidades", { query: { uf } });
  }

  /** Every neighborhood in a given city. */
  neighborhoods(uf: string, cidade: string): Promise<string[]> {
    return this.client.request("GET", "/api/v1/cep/bairros", { query: { uf, cidade } });
  }

  /** Straight-line distance between two CEPs — or, with `rota: true`,
   * driving distance/duration too. */
  distance(origem: string, destino: string, rota = false): Promise<CEPDistance> {
    return this.client.request("GET", `/api/v1/cep/distance/${origem}/${destino}`, { query: { rota } });
  }

  /** Looks up several CEPs in one call. Costs one rate-limit unit per CEP
   * requested, not one per call — see the CEP docs page. */
  bulk(ceps: string[]): Promise<CEPBulkResult[]> {
    return this.client.request("POST", "/api/v1/cep/lote", { json: { ceps } });
  }
}

export interface DNSResult {
  domain: string;
  authoritative: { servers: string[] };
  security: { blocked_big: boolean; blocked_nsfw: boolean };
}

export class DNSResource {
  constructor(private client: BaseClient) {}

  /** A, AAAA, NS, MX, TXT and CNAME records for a domain, plus an
   * ads/NSFW blocklist check. */
  lookup(domain: string): Promise<DNSResult> {
    return this.client.request("GET", `/api/v1/dns/${domain}`);
  }
}

export interface EmailResult {
  email: string;
  valid: boolean;
  mx_found: boolean;
  disposable: boolean;
}

export class EmailResource {
  constructor(private client: BaseClient) {}

  /** Syntax, MX records and (if enabled server-side) an SMTP probe. */
  verify(email: string): Promise<EmailResult> {
    return this.client.request("GET", "/api/v1/email/verify", { query: { email } });
  }
}

export interface SSLResult {
  domain: string;
  issuer: string;
  subject: string;
  not_before: string;
  not_after: string;
  days_until_expiry: number;
  sans: string[];
  is_expired: boolean;
  is_self_signed: boolean;
  is_valid: boolean;
}

export class SSLResource {
  constructor(private client: BaseClient) {}

  /** Validity, issuer and SANs for a domain's TLS certificate. */
  check(domain: string): Promise<SSLResult> {
    return this.client.request("GET", `/api/v1/ssl/${domain}`);
  }
}

export interface GeocodeResult {
  address: string;
  lat: number;
  lon: number;
}

export interface RouteResult {
  distance_km: number;
  duration_min: number;
}

export class MapsResource {
  constructor(private client: BaseClient) {}

  /** Address -> coordinates. */
  geocode(address: string): Promise<GeocodeResult> {
    return this.client.request("GET", "/api/v1/maps/geocode", { query: { address } });
  }

  /** Coordinates -> address. */
  reverse(lat: number, lon: number): Promise<GeocodeResult> {
    return this.client.request("GET", "/api/v1/maps/reverse", { query: { lat, lon } });
  }

  /** Driving distance/duration between two "lat,lon" points. */
  route(from: string, to: string): Promise<RouteResult> {
    return this.client.request("GET", "/api/v1/maps/route", { query: { from, to } });
  }
}

export interface TrustResult {
  domain: string;
  score: number;
  verdict: string;
  points_earned: number;
  points_possible: number;
  signals: Record<string, unknown>;
}

export class TrustResource {
  constructor(private client: BaseClient) {}

  /** Composite 0-100 trust score for a domain — SSL, DNS blocklist,
   * malware history, domain age, and (for .br domains, or when you pass
   * cnpj) business registration status. */
  check(domain: string, options: { cnpj?: string } = {}): Promise<TrustResult> {
    return this.client.request("GET", `/api/v1/trust/${domain}`, { query: options });
  }
}
