import { encode, type HttpClient } from "../http.js";
import type {
  AnularDocumentoParams,
  Anulacion,
  BuscarDocumentoParams,
  ConsultaDocumento,
  DocumentoInput,
  EnviarDocumentoOptions,
  EnvioDocumento,
  Evento,
  FormatoArchivo,
  ListaDocumentos,
  ListarDocumentosParams,
} from "../types.js";

const EXTENSION: Record<FormatoArchivo, string> = {
  pdf: ".pdf",
  ticket: ".ticket.pdf",
  xml: ".xml",
  cdr: ".cdr",
};

/** Facturas, boletas y notas de crédito y débito. */
export class DocumentosResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * POST /documentos/enviar: firma el XML, lo envía a SUNAT y devuelve el resultado.
   * Un rechazo de SUNAT no lanza error: llega con `estado: "RECHAZADA"` y el motivo en `sunat`.
   * Con `{ webhook: true }` responde al instante con `estado: "EN_PROCESO"`.
   */
  async enviar(documento: DocumentoInput, options: EnviarDocumentoOptions = {}): Promise<EnvioDocumento> {
    return this.http.request<EnvioDocumento>("POST", "/documentos/enviar", {
      webhook: options.webhook ?? false,
      ...(options.establecimiento ? { establecimiento: options.establecimiento } : {}),
      documento,
    });
  }

  /** POST /documentos/xml: genera y firma el XML sin enviarlo a SUNAT (`estado: "XML_GENERADO"`). */
  async generarXml(documento: DocumentoInput, options: Pick<EnviarDocumentoOptions, "establecimiento"> = {}): Promise<EnvioDocumento> {
    return this.http.request<EnvioDocumento>("POST", "/documentos/xml", {
      ...(options.establecimiento ? { establecimiento: options.establecimiento } : {}),
      documento,
    });
  }

  /** GET /documentos/{id}: el documento completo (cliente, totales, ítems) con su estado en SUNAT. */
  async consultar(id: string): Promise<ConsultaDocumento> {
    return this.http.request<ConsultaDocumento>("GET", `/documentos/${encode(id)}`);
  }

  /** GET /documentos/buscar: lo mismo que `consultar`, pero por tipo, serie y correlativo. */
  async buscar(params: BuscarDocumentoParams): Promise<ConsultaDocumento> {
    return this.http.request<ConsultaDocumento>("GET", "/documentos/buscar", undefined, {
      tipo_documento: params.tipoComprobante,
      serie: params.serie,
      correlativo: params.correlativo,
    });
  }

  /** GET /empresas/documentos: documentos del entorno del token, paginados. */
  async listar(params: ListarDocumentosParams = {}): Promise<ListaDocumentos> {
    return this.http.request<ListaDocumentos>("GET", "/empresas/documentos", undefined, {
      page: params.pagina,
      limite: params.limite,
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
      tipo: params.tipo,
      estado: params.estado,
      buscar: params.buscar,
      establecimiento: params.establecimiento,
    });
  }

  /**
   * POST /documentos/anular: facturas por Comunicación de Baja, boletas por Resumen Diario.
   * Si SUNAT aún procesa el ticket, vuelve `estado: "EN_PROCESO"`.
   */
  async anular(params: AnularDocumentoParams): Promise<Anulacion> {
    return this.http.request<Anulacion>("POST", "/documentos/anular", { documento: params });
  }

  /** POST /documentos/{id}/reenviar: reenvía a SUNAT un documento que quedó sin enviar o pendiente. */
  async reenviar(id: string): Promise<EnvioDocumento> {
    return this.http.request<EnvioDocumento>("POST", `/documentos/${encode(id)}/reenviar`);
  }

  /** GET /documentos/{id}/eventos: historial del documento (envíos, respuestas, webhooks, correos). */
  async eventos(id: string): Promise<{ documento: Record<string, unknown>; eventos: Evento[] }> {
    return this.http.request("GET", `/documentos/${encode(id)}/eventos`);
  }

  /** DELETE /documentos/{id}: solo documentos que nunca llegaron a SUNAT (NO_ENVIADA). */
  async eliminar(id: string): Promise<void> {
    await this.http.request("DELETE", `/documentos/${encode(id)}`);
  }

  /** URL pública del archivo (no requiere token). */
  urlArchivo(id: string, formato: FormatoArchivo = "pdf"): string {
    return this.http.fileUrl(`/documentos/${encode(id)}${EXTENSION[formato]}`);
  }

  /** Descarga el PDF (A4 o ticket), el XML firmado o el CDR de SUNAT. */
  async descargar(id: string, formato: FormatoArchivo = "pdf"): Promise<Buffer> {
    return this.http.download(this.urlArchivo(id, formato));
  }
}
