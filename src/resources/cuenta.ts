import { encode, type HttpClient } from "../http.js";
import type {
  Empresa,
  EmpresaInput,
  Entorno,
  Establecimiento,
  EstablecimientoInput,
  WebhookEventoConfig,
} from "../types.js";

/** Empresas emisoras de tu cuenta (token de usuario `user_sk_...`). */
export class EmpresasResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /empresas */
  async listar(): Promise<{ total: number; empresas: Empresa[] }> {
    return this.http.request("GET", "/empresas");
  }

  /** GET /empresas/{id} */
  async obtener(id: string): Promise<Empresa> {
    const data = await this.http.request<{ empresa: Empresa }>("GET", `/empresas/${encode(id)}`);
    return data.empresa;
  }

  /** GET /empresas/verificar-ruc/{ruc}: si el RUC ya está registrado en Facturalo. */
  async verificarRuc(ruc: string): Promise<{ disponible: boolean; motivo: string | null }> {
    return this.http.request("GET", `/empresas/verificar-ruc/${encode(ruc)}`);
  }

  /** POST /empresas: registra la empresa y genera sus tokens `sk_test_...` y `sk_live_...`. */
  async crear(empresa: EmpresaInput): Promise<Empresa> {
    const data = await this.http.request<{ empresa: Empresa }>("POST", "/empresas", { empresa });
    return data.empresa;
  }

  /** PATCH /empresas/{id}: solo cambia lo que envías (incluye `sunat` para Clave SOL y API SUNAT). */
  async actualizar(id: string, empresa: Partial<EmpresaInput>): Promise<Empresa> {
    const data = await this.http.request<{ empresa: Empresa }>("PATCH", `/empresas/${encode(id)}`, { empresa });
    return data.empresa;
  }

  /** PATCH /empresas/{id}/webhook: URL de webhook por entorno (`null` la quita). */
  async actualizarWebhook(id: string, webhook: { demo?: string | null; prod?: string | null }): Promise<Empresa> {
    const data = await this.http.request<{ empresa: Empresa }>("PATCH", `/empresas/${encode(id)}/webhook`, { webhook });
    return data.empresa;
  }

  /** GET /empresas/{id}/webhook/eventos: eventos activos por entorno. */
  async eventosWebhook(id: string): Promise<Record<Entorno, WebhookEventoConfig[]>> {
    return this.http.request("GET", `/empresas/${encode(id)}/webhook/eventos`);
  }

  /** PATCH /empresas/{id}/webhook/eventos: activa o desactiva eventos de un entorno. */
  async actualizarEventosWebhook(
    id: string,
    entorno: Entorno,
    eventos: WebhookEventoConfig[],
  ): Promise<{ entorno: Entorno; eventos: WebhookEventoConfig[] }> {
    return this.http.request("PATCH", `/empresas/${encode(id)}/webhook/eventos`, { entorno, eventos });
  }

  /** POST /empresas/{id}/regenerar-token: el token anterior deja de funcionar de inmediato. */
  async regenerarToken(id: string, entorno: Entorno): Promise<Empresa> {
    const data = await this.http.request<{ empresa: Empresa }>("POST", `/empresas/${encode(id)}/regenerar-token`, { entorno });
    return data.empresa;
  }

  /** POST /empresas/{id}/webhook/regenerar-secret: nuevo secreto para verificar `X-Facturalo-Firma`. */
  async regenerarSecretWebhook(id: string, entorno: Entorno): Promise<Empresa> {
    const data = await this.http.request<{ empresa: Empresa }>(
      "POST",
      `/empresas/${encode(id)}/webhook/regenerar-secret`,
      { entorno },
    );
    return data.empresa;
  }

  /** GET /empresas/{id}/certificado: titular y vigencia del certificado digital cargado. */
  async certificado(id: string): Promise<Record<string, unknown> | null> {
    const data = await this.http.request<{ certificado: Record<string, unknown> | null }>(
      "GET",
      `/empresas/${encode(id)}/certificado`,
    );
    return data.certificado;
  }
}

/** Establecimientos (locales) de una empresa. */
export class EstablecimientosResource {
  constructor(private readonly http: HttpClient) {}

  private base(empresaId: string): string {
    return `/empresas/${encode(empresaId)}/establecimientos`;
  }

  async listar(empresaId: string): Promise<{ total: number; establecimientos: Establecimiento[] }> {
    return this.http.request("GET", this.base(empresaId));
  }

  async obtener(empresaId: string, id: string): Promise<Establecimiento> {
    const data = await this.http.request<{ establecimiento: Establecimiento }>("GET", `${this.base(empresaId)}/${encode(id)}`);
    return data.establecimiento;
  }

  async crear(empresaId: string, establecimiento: EstablecimientoInput): Promise<Establecimiento> {
    const data = await this.http.request<{ establecimiento: Establecimiento }>("POST", this.base(empresaId), {
      establecimiento,
    });
    return data.establecimiento;
  }

  async actualizar(empresaId: string, id: string, establecimiento: Partial<EstablecimientoInput>): Promise<Establecimiento> {
    const data = await this.http.request<{ establecimiento: Establecimiento }>(
      "PATCH",
      `${this.base(empresaId)}/${encode(id)}`,
      { establecimiento },
    );
    return data.establecimiento;
  }

  async eliminar(empresaId: string, id: string): Promise<void> {
    await this.http.request("DELETE", `${this.base(empresaId)}/${encode(id)}`);
  }
}
