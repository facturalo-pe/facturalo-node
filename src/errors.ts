/**
 * Errores de validación por campo, tal como los devuelve la API (`errors` en la respuesta 422).
 * En campos de catálogo el valor trae además los códigos válidos.
 */
export type ValidationErrors = Record<
  string,
  string[] | { mensaje: string; valoresValidos?: { codigo: string; nombre: string }[] }
>;

/**
 * Códigos (`code`) que la API envía en errores de plan y acceso. Puede llegar otro código nuevo:
 * por eso `FacturaloApiError.code` es `string`.
 *
 * - 402 `BILLING_REQUIRED` / `BILLING_SUSPENDED` / `QUOTA_EXCEEDED` / `SALDO_INSUFICIENTE` / `PLAN_SIN_GUIAS`
 * - 403 `PLAN_SIN_API`: el plan Gratis no incluye la API de producción (`sk_live_`); está incluida en
 *   los planes de pago de Facturalo ERP (Básico, Pro, Negocio) y en los de Facturalo API. En demo (`sk_test_`) la API está abierta en todos los planes.
 * - 403 `PLAN_SOLO_API` / `CLAVE_SOLO_WOOCOMMERCE` / `SIN_PERMISO` / `SIN_ACCESO`
 * - 422 `PLAN_NO_DISPONIBLE`: una empresa con plan de Facturalo ERP intentó contratar un plan de Facturalo API
 *   (su plan de pago ya incluye la API); al cotizar o suscribirse.
 */
export type FacturaloErrorCode =
  | "BILLING_REQUIRED"
  | "BILLING_SUSPENDED"
  | "QUOTA_EXCEEDED"
  | "SALDO_INSUFICIENTE"
  | "PLAN_SIN_GUIAS"
  | "PLAN_SIN_API"
  | "PLAN_SOLO_API"
  | "PLAN_NO_DISPONIBLE"
  | "CLAVE_SOLO_WOOCOMMERCE"
  | "SIN_PERMISO"
  | "SIN_ACCESO";

export interface FacturaloApiErrorOptions {
  status: number;
  message: string;
  /** `code` de la respuesta, si la API lo envía (p. ej. `PLAN_SIN_API`). */
  code?: string;
  errors?: ValidationErrors;
  /** Cuerpo completo de la respuesta, por si necesitas algo más. */
  body?: unknown;
}

/** Error base de la API: cualquier respuesta HTTP fuera de 2xx lanza esto o una subclase. */
export class FacturaloApiError extends Error {
  readonly status: number;
  /** `code` de la respuesta (ver `FacturaloErrorCode`), o `undefined` si no vino. */
  readonly code?: FacturaloErrorCode | (string & {});
  readonly errors: ValidationErrors;
  readonly body?: unknown;

  constructor(options: FacturaloApiErrorOptions) {
    super(options.message);
    this.name = "FacturaloApiError";
    this.status = options.status;
    this.code = options.code;
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

/** 403: el token es válido pero no puede hacer esto (p. ej. `code: "PLAN_SIN_API"` en el plan Gratis). */
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
