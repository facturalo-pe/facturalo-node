import { encode, type HttpClient } from "../http.js";
import type {
  ConsultaGuia,
  EnviarGuiaOptions,
  EnvioGuia,
  Evento,
  GuiaInput,
  ListarGuiasParams,
  Paginacion,
} from "../types.js";

/** Guías de remisión remitente (serie T...) y transportista (serie V...). */
export class GuiasResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * POST /guias/enviar: la serie decide el tipo (T... remitente 09, V... transportista 31).
   * Con `{ webhook: true }` responde `EN_PROCESO` y el resultado llega como `guia.sunat.respuesta`.
   */
  async enviar(guia: GuiaInput, options: EnviarGuiaOptions = {}): Promise<EnvioGuia> {
    const headers = options.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : undefined;
    return this.http.request<EnvioGuia>(
      "POST",
      "/guias/enviar",
      { webhook: options.webhook ?? false, guia },
      undefined,
      headers,
    );
  }

  /** GET /guias/{id}: la guía completa con su estado en SUNAT. */
  async consultar(id: string): Promise<ConsultaGuia> {
    return this.http.request<ConsultaGuia>("GET", `/guias/${encode(id)}`);
  }

  /** POST /guias/ticket: consulta en SUNAT el ticket de una guía y actualiza su estado. */
  async consultarTicket(ticket: string): Promise<ConsultaGuia> {
    return this.http.request<ConsultaGuia>("POST", "/guias/ticket", { ticket });
  }

  /** GET /guias/{id}/eventos */
  async eventos(id: string): Promise<{ guia: Record<string, unknown>; eventos: Evento[] }> {
    return this.http.request("GET", `/guias/${encode(id)}/eventos`);
  }

  /** GET /empresas/guias: guías del entorno del token, paginadas. */
  async listar(
    params: ListarGuiasParams = {},
  ): Promise<{ entorno: string; paginacion: Paginacion; guias: Record<string, unknown>[] }> {
    return this.http.request("GET", "/empresas/guias", undefined, {
      page: params.pagina,
      limite: params.limite,
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
      estado: params.estado,
      buscar: params.buscar,
    });
  }

  /** URL pública del PDF, XML o CDR de la guía. */
  urlArchivo(id: string, formato: "pdf" | "xml" | "cdr" = "pdf"): string {
    return this.http.fileUrl(`/guias/${encode(id)}.${formato}`);
  }

  async descargar(id: string, formato: "pdf" | "xml" | "cdr" = "pdf"): Promise<Buffer> {
    return this.http.download(this.urlArchivo(id, formato));
  }
}
