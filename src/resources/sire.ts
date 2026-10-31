import { encode, type HttpClient, type Query } from "../http.js";

type Datos = Record<string, unknown>;

/**
 * Un libro del SIRE: ventas (RVIE) o compras (RCE). Los nombres de los parámetros son los de SUNAT
 * (`page`, `perPage`, `codTipoCDP`...) y se envían tal cual. `periodo` va como YYYYMM.
 * La empresa necesita las credenciales de la API SUNAT (client_id / client_secret).
 */
export class LibroSire {
  constructor(
    private readonly http: HttpClient,
    private readonly libro: "ventas" | "compras",
  ) {}

  private path(periodo: string, accion: string): string {
    return `/sire/${this.libro}/${encode(periodo)}/${accion}`;
  }

  /** Periodos disponibles del libro. */
  async periodos(): Promise<Datos> {
    return this.http.request("GET", `/sire/${this.libro}/periodos`);
  }

  /** Resumen de la propuesta. `tipo`: 1 propuesta (default), 2 preliminar... */
  async resumen(periodo: string, query: { tipo?: string } = {}): Promise<Datos> {
    return this.http.request("GET", this.path(periodo, "resumen"), undefined, query);
  }

  async resumenComprobantes(periodo: string, query: { tipo?: string } = {}): Promise<Datos> {
    return this.http.request("GET", this.path(periodo, "resumen-comprobantes"), undefined, query);
  }

  /** Comprobantes de la propuesta, paginados (`page`, `perPage`; en compras también `codTipoOpe`, `fecEmisionIni`, `fecEmisionFin`). */
  async comprobantes(periodo: string, query: Query = {}): Promise<Datos> {
    return this.http.request("GET", this.path(periodo, "comprobantes"), undefined, query);
  }

  /** Inconsistencias detectadas por SUNAT (`page`, `perPage`, `s`, `ord`). */
  async inconsistencias(periodo: string, query: Query = {}): Promise<Datos> {
    return this.http.request("GET", this.path(periodo, "inconsistencias"), undefined, query);
  }

  /** Detalle de inconsistencias de un comprobante (`codTipoCDP`, `numSerieCDP`, `numCDP`, `codCar`, `codOrigen`). */
  async inconsistenciaPorComprobante(periodo: string, query: Query): Promise<Datos> {
    return this.http.request("GET", this.path(periodo, "inconsistencia-por-comprobante"), undefined, query);
  }

  /** Acepta la propuesta de SUNAT para el periodo. */
  async aceptarPropuesta(periodo: string, body: Datos = {}): Promise<Datos> {
    return this.http.request("POST", this.path(periodo, "aceptar-propuesta"), body);
  }

  /** Pide a SUNAT la exportación del periodo; devuelve un ticket para `descargarTicket`. */
  async exportar(periodo: string, query: Query = {}): Promise<Datos> {
    return this.http.request("GET", this.path(periodo, "exportar"), undefined, query);
  }

  async descargarTicket(numTicket: string): Promise<Datos> {
    return this.http.request("GET", `/sire/${this.libro}/tickets/${encode(numTicket)}/descargar`);
  }

  /** Comprobantes preliminares registrados (`page`, `perPage`). */
  async preliminares(periodo: string, query: Query = {}): Promise<Datos> {
    return this.http.request("GET", this.path(periodo, "preliminares"), undefined, query);
  }

  async eliminarPreliminar(periodo: string, body: Datos): Promise<Datos> {
    return this.http.request("PUT", this.path(periodo, "eliminar-preliminar"), body);
  }

  async eliminarPreliminarRegistrado(periodo: string, body: { id: string; codTipoRegistro?: string }): Promise<Datos> {
    return this.http.request("PUT", this.path(periodo, "eliminar-preliminar-registrado"), body);
  }

  /** Inicia la conciliación de tus comprobantes con la propuesta de SUNAT. */
  async conciliar(periodo: string, body: Datos = {}): Promise<Datos> {
    return this.http.request("POST", this.path(periodo, "conciliar"), body);
  }
}

export class SireResource {
  readonly ventas: LibroSire;
  readonly compras: LibroSire;

  constructor(private readonly http: HttpClient) {
    this.ventas = new LibroSire(http, "ventas");
    this.compras = new LibroSire(http, "compras");
  }

  /** Estado de una conciliación iniciada con `ventas.conciliar` o `compras.conciliar`. */
  async conciliacion(conciliacionId: string): Promise<Datos> {
    return this.http.request("GET", `/sire/conciliaciones/${encode(conciliacionId)}`);
  }
}
