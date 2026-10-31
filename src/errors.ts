/**
 * Errores de validación por campo, tal como los devuelve la API (`errors` en la respuesta 422).
 * En campos de catálogo el valor trae además los códigos válidos.
 */
export type ValidationErrors = Record<
  string,
  string[] | { mensaje: string; valoresValidos?: { codigo: string; nombre: string }[] }
>;

export interface FacturaloApiErrorOptions {
  status: number;
  message: string;
  errors?: ValidationErrors;
  /** Cuerpo completo de la respuesta, por si necesitas algo más. */
  body?: unknown;
}

/** Error base de la API: cualquier respuesta HTTP fuera de 2xx lanza esto o una subclase. */
export class FacturaloApiError extends Error {
  readonly status: number;
  readonly errors: ValidationErrors;
  readonly body?: unknown;

  constructor(options: FacturaloApiErrorOptions) {
    super(options.message);
    this.name = "FacturaloApiError";
    this.status = options.status;
    this.errors = options.errors ?? {};
    this.body = options.body;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401: el token falta, es inválido o fue regenerado. */
export class FacturaloAuthenticationError extends FacturaloApiError {
  constructor(options: FacturaloApiErrorOptions) {
    super(options);
    this.name = "FacturaloAuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 403: el token es válido pero no puede hacer esto. */
export class FacturaloPermissionError extends FacturaloApiError {
  constructor(options: FacturaloApiErrorOptions) {
    super(options);
    this.name = "FacturaloPermissionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 404: el documento, guía o empresa no existe en este entorno. */
export class FacturaloNotFoundError extends FacturaloApiError {
  constructor(options: FacturaloApiErrorOptions) {
    super(options);
    this.name = "FacturaloNotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 / 422: la petición no pasó validación, o la operación no procede (p. ej. anular un documento
 * que no existe en SUNAT). Revisa `.errors` para el campo exacto.
 */
export class FacturaloValidationError extends FacturaloApiError {
  constructor(options: FacturaloApiErrorOptions) {
    super(options);
    this.name = "FacturaloValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 429: demasiadas peticiones. El SDK ya reintenta las consultas antes de lanzar esto. */
export class FacturaloRateLimitError extends FacturaloApiError {
  constructor(options: FacturaloApiErrorOptions) {
    super(options);
    this.name = "FacturaloRateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Fallo de red o timeout: no hubo respuesta HTTP de Facturalo. */
export class FacturaloConnectionError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "FacturaloConnectionError";
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** La firma del webhook (`X-Facturalo-Firma`) no coincide con el cuerpo recibido. */
export class FacturaloSignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacturaloSignatureVerificationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorForStatus(options: FacturaloApiErrorOptions): FacturaloApiError {
  switch (options.status) {
    case 401:
      return new FacturaloAuthenticationError(options);
    case 403:
      return new FacturaloPermissionError(options);
    case 404:
      return new FacturaloNotFoundError(options);
    case 400:
    case 422:
      return new FacturaloValidationError(options);
    case 429:
      return new FacturaloRateLimitError(options);
    default:
      return new FacturaloApiError(options);
  }
}
