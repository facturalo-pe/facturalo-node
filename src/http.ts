import { errorForStatus, FacturaloApiError, FacturaloConnectionError, type ValidationErrors } from "./errors.js";

export const DEFAULT_BASE_URL = "https://api.facturalo.pe/api/v3";
/** El envío síncrono espera la respuesta de SUNAT: puede tardar varios segundos. */
const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Query = Record<string, string | number | boolean | undefined | null>;

export interface HttpOptions {
  token: string;
  baseUrl?: string;
  /** Milisegundos antes de abortar una petición. Default 90 000. */
  timeoutMs?: number;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: ValidationErrors;
}

/**
 * Transporte HTTP compartido por los dos clientes. Resuelve auth, timeouts, reintentos y errores;
 * los recursos solo arman ruta y cuerpo.
 */
export class HttpClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: HttpOptions) {
    if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
      throw new Error(
        "El SDK de Facturalo usa tu token secreto y solo debe correr en el servidor. " +
          "Nunca importes @facturalo-pe/node en código del navegador.",
      );
    }
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Devuelve `data` del sobre `{ success, message, data }`. */
  async request<T>(method: HttpMethod, path: string, body?: unknown, query?: Query): Promise<T> {
    const envelope = await this.send<Envelope<T>>(method, path, body, query);
    return envelope.data as T;
  }

  /** Igual que `request`, pero devuelve el sobre completo (incluye `success` y `message`). */
  async requestEnvelope<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    query?: Query,
  ): Promise<{ success: boolean; message: string; data: T }> {
    const envelope = await this.send<Envelope<T>>(method, path, body, query);
    return { success: envelope.success, message: envelope.message ?? "", data: envelope.data as T };
  }

  /** Descarga binaria (PDF, XML, CDR). Las URLs de archivos son públicas: no envía el token. */
  async download(url: string): Promise<Buffer> {
    const response = await this.fetchWithTimeout(url, { method: "GET" });
    if (!response.ok) {
      throw errorForStatus({ status: response.status, message: `No se pudo descargar ${url}` });
    }
    return Buffer.from(await response.arrayBuffer());
  }

  fileUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async send<T>(method: HttpMethod, path: string, body?: unknown, query?: Query): Promise<T> {
    const headers: Record<string, string> = {
      // Facturalo no usa el esquema Bearer: el token va tal cual.
      Authorization: this.token,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    // Solo se reintentan lecturas. Un POST de envío nunca se repite a ciegas: podría emitir
    // dos veces el mismo comprobante o chocar con el correlativo ya usado.
    const canRetry = method === "GET";
    const url = this.baseUrl + path + toQueryString(query);

    let lastError: unknown;
    for (let attempt = 0; attempt <= (canRetry ? MAX_RETRIES : 0); attempt++) {
      if (attempt > 0) await sleep(2 ** attempt * 200);
      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        lastError = new FacturaloConnectionError("No se pudo conectar con la API de Facturalo.", err);
        if (canRetry) continue;
        throw lastError;
      }

      const parsed = await safeParseJson<Envelope<unknown>>(response);
      if (response.ok) return (parsed ?? { success: true }) as T;

      const apiError = errorForStatus({
        status: response.status,
        message: parsed?.message ?? response.statusText,
        errors: parsed?.errors,
        body: parsed,
      });
      if (canRetry && RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
        lastError = apiError;
        continue;
      }
      throw apiError;
    }
    throw lastError instanceof Error ? lastError : new FacturaloApiError({ status: 0, message: "Error desconocido." });
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
  }
}

function toQueryString(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function safeParseJson<T>(response: Response): Promise<T | undefined> {
  try {
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function encode(segment: string): string {
  return encodeURIComponent(segment);
}
