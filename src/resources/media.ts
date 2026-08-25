/**
 * QRCode, Imagem, Templating — the APIs whose successful response is a
 * raw file (a PNG, a transformed image, a PDF), not the usual JSON
 * envelope. Every method here returns a `BinaryResponse` — call
 * `.save(path)` on it, or use `.content`/`.contentType` directly.
 */

import type { BaseClient } from "../client";
import { BinaryResponse } from "../client";

/** Pix's input for `qrcode.pix()`. `chave`/`nome`/`cidade` are required;
 * the rest are optional. `nome`/`cidade` get uppercased and stripped of
 * accents server-side, same as a card terminal, send them however you
 * like. */
export interface PixParams {
  /** The recipient's Pix key: CPF, CNPJ, email, phone or random key. */
  chave: string;
  /** The recipient's name, up to 25 characters. */
  nome: string;
  /** The recipient's city, up to 15 characters. */
  cidade: string;
  /** The charge amount in reais (e.g. 10.50). Omit it and the payer
   * types in the amount themselves. */
  valor?: number;
  /** Identifies the transaction, letters and digits only, up to 25
   * characters. Omit it and it defaults to `***` (the standard's own
   * "no identifier" convention). */
  txid?: string;
  /** Free text embedded in the payload, up to 72 characters. */
  descricao?: string;
  /** Image side in pixels, 64-1024. Omit it for the API's default. */
  size?: number;
}

export class QRCodeResource {
  constructor(private client: BaseClient) {}

  /** Generates a QR code PNG for arbitrary text or a URL. */
  generate(data: string, size?: number): Promise<BinaryResponse> {
    return this.client.requestRaw("GET", "/api/v1/qrcode", { query: { data, size } });
  }

  /** Generates a static Pix QR code: builds the EMV/BR Code payload from
   * `params` and renders it, same encoder and cache as `generate()`.
   * Doesn't validate that `chave` actually exists, that needs the
   * Central Bank's DICT, out of scope here, only its format and length.
   *
   * The response's `.headers.get("X-Pix-Copia-Cola")` carries the same
   * payload as plain text (the "copia e cola" code), for when you want
   * to show both. */
  pix(params: PixParams): Promise<BinaryResponse> {
    return this.client.requestRaw("GET", "/api/v1/qrcode/pix", { query: { ...params } });
  }
}

/** Image transforms — see https://alicercelabs.com.br/apis/imagem for the
 * full list of query parameters (`resize`, `crop`, `rotate`, `format`,
 * `quality`, `watermark_text`, `grayscale`, `blur`, `round`, and many
 * more, added over several phases of the API). Passed through as-is via
 * `params` so this SDK doesn't go stale as new ones ship server-side. */
export class ImagemResource {
  constructor(private client: BaseClient) {}

  /** Transforms an image, either uploaded directly (`image`) or fetched
   * server-side (`url`). Exactly one of the two is required. */
  transform(
    source: { image: Uint8Array; url?: undefined } | { image?: undefined; url: string },
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<BinaryResponse> {
    const query = { ...params, url: source.url };
    return this.client.requestRaw("POST", "/api/v1/imagem/transform", { query, body: source.image });
  }

  /** Returns metadata about an image (dimensions, dominant color,
   * palette, BlurHash) without transforming it — the normal JSON
   * envelope, not raw bytes. */
  analyze(
    source: { image: Uint8Array; url?: undefined } | { image?: undefined; url: string }
  ): Promise<{
    width: number;
    height: number;
    format: string;
    dominant_color: string;
    palette: string[];
    blurhash: string;
  }> {
    return this.client.request("POST", "/api/v1/imagem/analyze", {
      query: { url: source.url },
      body: source.image,
    });
  }
}

export interface InvoiceParty {
  name: string;
  document?: string;
  address?: string;
  email?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface InvoiceRequest {
  invoice_number?: string;
  currency?: string;
  issuer: InvoiceParty;
  recipient: InvoiceParty;
  items: InvoiceItem[];
  notes?: string;
}

export class TemplatingResource {
  constructor(private client: BaseClient) {}

  /** Generates an invoice PDF. Totals are always computed server-side
   * from each item's quantity/unit_price. */
  invoice(request: InvoiceRequest): Promise<BinaryResponse> {
    return this.client.requestRaw("POST", "/api/v1/templating/invoice", { json: request });
  }
}
