/**
 * Errors raised by the AlicerceLabs client.
 *
 * Every non-2xx response from the API throws an `AlicerceLabsError` (or one
 * of its subclasses below, chosen by HTTP status). The message always
 * comes from the API's own JSON envelope (`{"success": false, "error":
 * "..."}`) — even the endpoints whose success response is raw bytes
 * (QRCode, Imagem's transform, Templating, Functions' invoke) still report
 * errors this way.
 */

export class AlicerceLabsError extends Error {
  readonly statusCode?: number;
  readonly requestId?: string;

  constructor(message: string, options: { statusCode?: number; requestId?: string } = {}) {
    super(message);
    this.name = "AlicerceLabsError";
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
  }
}

export class ValidationError extends AlicerceLabsError {
  constructor(message: string, options: { statusCode?: number; requestId?: string } = {}) {
    super(message, options);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AlicerceLabsError {
  constructor(message: string, options: { statusCode?: number; requestId?: string } = {}) {
    super(message, options);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends AlicerceLabsError {
  constructor(message: string, options: { statusCode?: number; requestId?: string } = {}) {
    super(message, options);
    this.name = "NotFoundError";
  }
}

/** 429 — quota exceeded. `retryAfter` is seconds, from the `Retry-After`
 * response header, when the server sent one. */
export class RateLimitError extends AlicerceLabsError {
  readonly retryAfter?: number;

  constructor(
    message: string,
    options: { statusCode?: number; requestId?: string; retryAfter?: number } = {}
  ) {
    super(message, options);
    this.name = "RateLimitError";
    this.retryAfter = options.retryAfter;
  }
}

/** 503 — an optional dependency for this endpoint isn't configured, or is
 * temporarily down. Not every AlicerceLabs deployment enables every API;
 * this is how you find out one is off. */
export class ServiceUnavailableError extends AlicerceLabsError {
  constructor(message: string, options: { statusCode?: number; requestId?: string } = {}) {
    super(message, options);
    this.name = "ServiceUnavailableError";
  }
}

export class ServerError extends AlicerceLabsError {
  constructor(message: string, options: { statusCode?: number; requestId?: string } = {}) {
    super(message, options);
    this.name = "ServerError";
  }
}

export function errorForStatus(
  statusCode: number,
  message: string,
  options: { requestId?: string; retryAfter?: number } = {}
): AlicerceLabsError {
  const opts = { statusCode, requestId: options.requestId };
  switch (statusCode) {
    case 400:
      return new ValidationError(message, opts);
    case 401:
      return new AuthenticationError(message, opts);
    case 404:
      return new NotFoundError(message, opts);
    case 429:
      return new RateLimitError(message, { ...opts, retryAfter: options.retryAfter });
    case 503:
      return new ServiceUnavailableError(message, opts);
    default:
      return statusCode >= 500 ? new ServerError(message, opts) : new AlicerceLabsError(message, opts);
  }
}
