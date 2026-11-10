import { encode, type HttpClient } from "../http.js";

type Datos = Record<string, unknown>;

/** Consultas de RUC, DNI, tipo de cambio, vehículos y código de producto SUNAT. Aceptan token de empresa o de usuario. */
export class ConsultasResource {
  constructor(private readonly http: HttpClient) {}

  /** GET /consulta/dni/{dni} */
  async dni(dni: string): Promise<Datos> {
    return this.http.request("GET", `/consulta/dni/${encode(dni)}`);
  }

  /** GET /consulta/ruc/{ruc}: razón social, estado, condición, dirección y ubigeo. */
  async ruc(ruc: string): Promise<Datos> {
    return this.http.request("GET", `/consulta/ruc/${encode(ruc)}`);
  }

  /** GET /consulta/ruc/{ruc}/anexos: establecimientos anexos registrados en SUNAT. */
  async rucEstablecimientos(ruc: string): Promise<Datos> {
    return this.http.request("GET", `/consulta/ruc/${encode(ruc)}/anexos`);
  }

  /** GET /consulta/ruc/{ruc}/representantes */
  async rucRepresentantes(ruc: string): Promise<Datos> {
    return this.http.request("GET", `/consulta/ruc/${encode(ruc)}/representantes`);
  }

  /** GET /consulta/tipo-cambio: tipo de cambio SUNAT. Sin fecha, el del día. */
  async tipoCambio(fecha?: string): Promise<Datos> {
    return this.http.request("GET", "/consulta/tipo-cambio", undefined, { fecha });
  }

  /** GET /consulta/placa/{placa} */
  async placa(placa: string): Promise<Datos> {
    return this.http.request("GET", `/consulta/placa/${encode(placa)}`);
  }

  /** GET /consulta/placa/{placa}/soat */
  async soat(placa: string): Promise<Datos> {
    return this.http.request("GET", `/consulta/placa/${encode(placa)}/soat`);
  }

  /**
   * GET /catalogos/productos-sunat: código de producto SUNAT (catálogo UNSPSC de 8 dígitos) a partir
   * de una descripción ("laptop core i5", "servicio de instalación"). Búsqueda semántica sobre el CUBSO.
   * Úsalo para completar `codigoProductoSunat` de cada ítem.
   */
  async codigoProductoSunat(
    descripcion: string,
    opciones: { tipo?: "bien" | "servicio" | "obra" | "consultoria_obra"; limite?: number } = {},
  ): Promise<Datos> {
    return this.http.request("GET", "/catalogos/productos-sunat", undefined, { q: descripcion, tipo: opciones.tipo, limite: opciones.limite });
  }

  /** GET /consulta/licencia/{dni} */
  async licencia(dni: string): Promise<Datos> {
    return this.http.request("GET", `/consulta/licencia/${encode(dni)}`);
  }
}
