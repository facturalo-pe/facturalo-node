import { HttpClient } from "./http.js";
import { ConsultasResource } from "./resources/consultas.js";
import { EmpresasResource, EstablecimientosResource } from "./resources/cuenta.js";
import { DocumentosResource } from "./resources/documentos.js";
import { GuiasResource } from "./resources/guias.js";
import { SireResource } from "./resources/sire.js";
import { WebhooksResource } from "./resources/webhooks.js";
import type { Entorno } from "./types.js";

export interface FacturaloClientOptions {
  /** Token de la empresa: `sk_test_...` (demo) o `sk_live_...` (producción). El token decide el entorno. */
  token: string;
  /** Solo para apuntar a otra URL (p. ej. un entorno local). Default https://api.facturalo.pe/api/v3 */
  baseUrl?: string;
  /** Milisegundos antes de abortar una petición. Default 90 000 (el envío síncrono espera a SUNAT). */
  timeoutMs?: number;
}

const COMPANY_TOKEN_PREFIXES = ["sk_test_", "sk_live_"];

/**
 * Cliente con el token de una empresa. Emite y consulta comprobantes y guías, consulta RUC/DNI,
 * revisa los webhooks enviados y trabaja el SIRE.
 *
 * ```ts
 * const facturalo = new FacturaloClient({ token: process.env.FACTURALO_TOKEN! });
 * const envio = await facturalo.documentos.enviar({ ... });
 * ```
 */
export class FacturaloClient {
  readonly entorno: Entorno;
  readonly documentos: DocumentosResource;
  readonly guias: GuiasResource;
  readonly consultas: ConsultasResource;
  readonly webhooks: WebhooksResource;
  readonly sire: SireResource;

  constructor(options: FacturaloClientOptions) {
    if (!COMPANY_TOKEN_PREFIXES.some((prefix) => options.token?.startsWith(prefix))) {
      throw new Error(
        "FacturaloClient espera el token de una empresa (sk_test_... / sk_live_...). " +
          "Para el token de usuario (user_sk_...) usa FacturaloCuentaClient.",
      );
    }
    const http = new HttpClient(options);
    this.entorno = options.token.startsWith("sk_live_") ? "prod" : "demo";
    this.documentos = new DocumentosResource(http);
    this.guias = new GuiasResource(http);
    this.consultas = new ConsultasResource(http);
    this.webhooks = new WebhooksResource(http);
    this.sire = new SireResource(http);
  }
}

export interface FacturaloCuentaClientOptions {
  /** Token de usuario `user_sk_...` (se ve en tu perfil de la consola). */
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Cliente con el token de usuario: administra empresas, sus tokens, webhooks y establecimientos.
 * Útil para software que da de alta empresas de sus clientes.
 */
export class FacturaloCuentaClient {
  readonly empresas: EmpresasResource;
  readonly establecimientos: EstablecimientosResource;
  readonly consultas: ConsultasResource;

  constructor(options: FacturaloCuentaClientOptions) {
    if (!options.token?.startsWith("user_sk_")) {
      throw new Error(
        "FacturaloCuentaClient espera el token de usuario (user_sk_...). " +
          "Para emitir comprobantes usa FacturaloClient con el token de la empresa.",
      );
    }
    const http = new HttpClient(options);
    this.empresas = new EmpresasResource(http);
    this.establecimientos = new EstablecimientosResource(http);
    this.consultas = new ConsultasResource(http);
  }
}
