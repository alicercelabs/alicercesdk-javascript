/**
 * IP, CEP, DNS, Email, SSL, Maps, Trust — the read-only lookup APIs. See
 * https://alicercelabs.com.br/apis/{ip,cep,dns,email,ssl,maps,trust} for
 * the exact field names each one returns.
 */

import type { BaseClient } from "../client";

export interface IPResult {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  asn: string;
}

export class IPResource {
  constructor(private client: BaseClient) {}

  /** Geolocates a specific public IPv4/IPv6 address. */
  lookup(ip: string): Promise<IPResult> {
    return this.client.request("GET", `/api/v1/ip/${ip}`);
  }

  /** Geolocates the caller — the IP the request itself came from. */
  self(): Promise<IPResult> {
    return this.client.request("GET", "/api/v1/ip/self");
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
