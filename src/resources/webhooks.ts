import { encode, type HttpClient } from "../http.js";
import type { ListarWebhooksParams, ListaWebhooks } from "../types.js";

/** Historial de webhooks enviados a tu URL. La URL y los eventos se configuran con FacturaloCuenta. */
export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /webhooks */
  async listar(params: ListarWebhooksParams = {}): Promise<ListaWebhooks> {
    return this.http.request<ListaWebhooks>("GET", "/webhooks", undefined, {
      page: params.pagina,
      limite: params.limite,
      estado: params.estado,
      evento: params.evento,
    });
  }

  /** POST /webhooks/{eventoId}/reenviar: vuelve a enviar un webhook (los fallidos no se reintentan solos). */
  async reenviar(eventoId: string): Promise<{ evento: string; documentoId: string | null }> {
    return this.http.request("POST", `/webhooks/${encode(eventoId)}/reenviar`);
  }
}
