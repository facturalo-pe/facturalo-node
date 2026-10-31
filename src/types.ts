// Comunes

export type Entorno = "demo" | "prod";
export type Moneda = "PEN" | "USD";
export type FormaPago = "CONTADO" | "CREDITO";
export type UnidadMedida = "NIU" | "ZZ" | "BX" | "PK" | "KT" | "GLI";
/** 01 factura · 03 boleta · 07 nota de crédito · 08 nota de débito */
export type TipoComprobante = "01" | "03" | "07" | "08";
export type TipoDocumentoTexto = "FACTURA" | "BOLETA" | "NOTA_CREDITO" | "NOTA_DEBITO" | "DOCUMENTO";

/** Estado del comprobante en Facturalo / SUNAT. */
export type EstadoDocumento =
  | "ACEPTADA"
  | "OBSERVADA"
  | "RECHAZADA"
  | "EN_PROCESO"
  | "PROCESANDO"
  | "ENVIADA"
  | "NO_ENVIADA"
  | "ANULADA"
  | "XML_GENERADO"
  | (string & {});

export interface Paginacion {
  total: number;
  limite: number;
  pagina: number;
  paginas: number;
}

export interface CampoLibre {
  label: string;
  value: string;
}

export interface RespuestaSunat {
  estado?: string;
  codigo: string | null;
  mensaje: string | null;
  notas: string[];
}

export interface EnlacesDocumento {
  pdf?: string;
  pdfTicket?: string;
  xml?: string;
  /** Solo cuando SUNAT aceptó el comprobante. */
  cdr?: string;
  /** En la respuesta 202 (EN_PROCESO): URL para consultar el estado. */
  consulta?: string;
}

// Documentos: lo que envías

export interface ClienteInput {
  /** Catálogo 06: 6 RUC · 1 DNI · 4 carné de extranjería · 7 pasaporte · 0 sin documento. */
  tipoDocumento: string;
  numeroDocumento?: string;
  denominacion: string;
  /** Obligatoria con RUC. */
  direccion?: string;
  correo?: string;
  celular?: string;
}

export interface ItemInput {
  unidadMedida: UnidadMedida;
  descripcion: string;
  cantidad: number;
  /** Precio unitario CON IGV. Facturalo calcula valor unitario, IGV y totales. */
  precioUnitario: number;
  /** Catálogo 07: 10 gravado · 20 exonerado · 30 inafecto · 40 exportación · 11-16/21/31-37 gratuitas. */
  tipoIgv: string;
  codigo?: string;
  /** Obligatorio en exportación (sunatTransaccion 0200). */
  codigoSunat?: string;
  codigoProductoSunat?: string;
  descuento?: number;
  /** Aplica el impuesto a las bolsas plásticas (ICBPER). */
  icbper?: boolean;
}

export interface CuotaInput {
  fechaPago: string;
  monto: number;
}

export interface GuiaRelacionadaInput {
  /** 09 remitente · 31 transportista */
  tipoDocumento: "09" | "31";
  /** Serie-correlativo, p. ej. "T001-00000001". */
  numeroDocumento: string;
}

export interface AnticipoInput {
  tipoDocumento: "02" | "03";
  serie: string;
  correlativo: string;
  monto: number;
}

export interface NotaInput {
  documentoQueSeModifica: "FACTURA" | "BOLETA";
  documentoQueSeModificaSerie: string;
  documentoQueSeModificaCorrelativo: string;
  /** Catálogo 09, solo en notas de crédito (07). */
  tipoDeNotaDeCredito?: string;
  /** Catálogo 10, solo en notas de débito (08). */
  tipoDeNotaDeDebito?: string;
  sustento?: string;
}

export interface DetraccionInput {
  /** Catálogo 54 (bien o servicio sujeto). */
  tipo?: string;
  /** Catálogo 59 (medio de pago). */
  medioPago?: string;
  ctaBanco?: string;
  porcentaje?: number;
  monto?: number;
}

export interface RetencionInput {
  tipo?: string;
  porcentaje?: number;
}

export interface DocumentoInput {
  /** Catálogo 51: 0101 venta interna · 0200 exportación · 1001 detracción... Obligatorio en factura y boleta. */
  sunatTransaccion?: string;
  tipoComprobante: TipoComprobante;
  serie: string;
  /** Hasta 8 dígitos; las respuestas lo devuelven con ceros a la izquierda. */
  correlativo: string;
  /** YYYY-MM-DD */
  fechaEmision: string;
  fechaVencimiento?: string;
  formaPago: FormaPago;
  moneda: Moneda;
  cliente: ClienteInput;
  items: ItemInput[];
  /** Obligatorio con formaPago CREDITO. */
  cuotas?: CuotaInput[];
  guias?: GuiaRelacionadaInput[];
  anticipos?: AnticipoInput[];
  /** Obligatorio en notas de crédito y débito. */
  nota?: NotaInput;
  detraccion?: DetraccionInput;
  retencion?: RetencionInput;
  /** UUID del establecimiento que emite. */
  establecimiento?: string;
  notificarCorreo?: boolean;
  observaciones?: string;
  placaVehiculo?: string;
  ordenCompra?: string;
  /** Campos libres que salen en el PDF y la consulta. No van a SUNAT. */
  otrosCampos?: CampoLibre[];
  descuentoGlobal?: number;
  totalAnticipo?: number;
  totalOtrosCargos?: number;
  totalIsc?: number;
  /** 18 (por defecto) o 10 (régimen MYPE restaurantes y hoteles). */
  porcentajeIgv?: 10 | 18;
}

export interface EnviarDocumentoOptions {
  /**
   * `false` (por defecto): espera la respuesta de SUNAT. `true`: responde al instante con
   * `EN_PROCESO` y el resultado llega a tu webhook (`documento.sunat.respuesta`).
   */
  webhook?: boolean;
  /** UUID del establecimiento que emite. */
  establecimiento?: string;
}

// Documentos: lo que vuelve

/** Identificación del comprobante (respuesta de envío y webhooks). */
export interface DocumentoResumen {
  id: string;
  estado?: EstadoDocumento;
  serie: string;
  correlativo: string;
  tipo: TipoDocumentoTexto;
}

/** Respuesta de `documentos.enviar`. Si `estado` es RECHAZADA, el motivo está en `sunat`. */
export interface EnvioDocumento {
  estado: EstadoDocumento;
  entorno: Entorno;
  documento: DocumentoResumen;
  /** No viene en la respuesta EN_PROCESO (webhook: true). */
  sunat?: RespuestaSunat;
  enlaces: EnlacesDocumento;
  hash?: string | null;
  /** Texto para el QR del comprobante (formato SUNAT). */
  cadenaQr?: string;
}

export interface DocumentoDetalle extends DocumentoResumen {
  tipoCodigo: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  moneda: Moneda;
  formaPago: FormaPago;
  cliente: {
    tipoDocumento: string | null;
    numeroDocumento: string | null;
    denominacion: string | null;
    direccion: string | null;
  };
  totales: {
    gravada: number;
    exonerada: number;
    inafecta: number;
    exportacion: number;
    gratuita: number;
    descuento: number;
    anticipo: number;
    isc: number;
    igv: number;
    impuestoBolsa: number;
    otrosCargos: number;
    total: number;
  };
  items: {
    codigo: string | null;
    descripcion: string;
    unidad: string;
    cantidad: number;
    valorUnitario: number;
    precioUnitario: number;
    descuento: number;
    subtotal: number;
    tipoIgv: string | null;
    tipoIgvDescripcion: string | null;
    igv: number;
    total: number;
  }[];
  guias: { tipoDocumento: string | null; numeroDocumento: string }[];
  cuotas: { fechaPago: string; monto: number }[];
  anticipos: { tipoDocumento: string | null; serie: string; correlativo: string; monto: number }[];
  nota?: Record<string, string | null>;
  otrosCampos?: CampoLibre[];
}

/** Respuesta de `documentos.consultar` y `documentos.buscar`: el documento completo. */
export interface ConsultaDocumento {
  estado: EstadoDocumento;
  entorno: Entorno;
  documento: DocumentoDetalle;
  sunat: RespuestaSunat & { anulacion?: Record<string, unknown> };
  enlaces: EnlacesDocumento;
  hash: string | null;
  cadenaQr: string | null;
}

export interface ListarDocumentosParams {
  pagina?: number;
  /** Máximo 100. Default 20. */
  limite?: number;
  /** YYYY-MM-DD */
  fechaInicio?: string;
  fechaFin?: string;
  /** Un código o varios separados por coma: "01,03". */
  tipo?: string;
  estado?: "ACEPTADA" | "RECHAZADA" | "NO_ENVIADA" | "ANULADA";
  /** Serie-correlativo (F001-123), número de documento o nombre del cliente. */
  buscar?: string;
  establecimiento?: string;
}

export interface ListaDocumentos {
  entorno: Entorno;
  paginacion: Paginacion;
  documentos: Record<string, unknown>[];
}

export interface BuscarDocumentoParams {
  tipoComprobante: TipoComprobante;
  serie: string;
  correlativo: string;
}

export interface AnularDocumentoParams {
  tipoComprobante: TipoComprobante;
  serie: string;
  correlativo: string;
  motivo: string;
}

/** Respuesta de `documentos.anular`. */
export interface Anulacion {
  /** ANULADA · EN_PROCESO (ticket pendiente en SUNAT) · RECHAZADA · NO_ENVIADA */
  estado: "ANULADA" | "EN_PROCESO" | "RECHAZADA" | "NO_ENVIADA";
  documento: { id: string; tipo: string; serie: string; correlativo: string };
  sunat: {
    codigo: string | null;
    mensaje: string | null;
    notas: string[];
    ticket: string | null;
    hash: string | null;
    nombreArchivo: string | null;
    procesada: boolean;
  };
}

export type FormatoArchivo = "pdf" | "ticket" | "xml" | "cdr";

// Guías de remisión

export interface PartyInput {
  tipoDocumento: string;
  numeroDocumento: string;
  denominacion: string;
  correo?: string;
  celular?: string;
}

export interface PuntoInput {
  /** Ubigeo INEI de 6 dígitos. */
  ubigeo: string;
  direccion: string;
}

export interface GuiaItemInput {
  codigo: string;
  descripcion: string;
  unidadMedida: UnidadMedida;
  cantidad: number;
}

/**
 * Cuerpo de la guía. La serie decide el tipo: T... remitente (09), V... transportista (31).
 * Los campos de transporte dependen del tipo y de `tipoTransporte`; ver docs.facturalo.pe.
 */
export interface GuiaInput {
  serie: string;
  correlativo: string;
  fechaEmision: string;
  motivoTraslado: string;
  /** Catálogo 18: 01 público · 02 privado (solo remitente). */
  tipoTransporte?: string;
  observaciones?: string;
  enviarCorreo?: boolean;
  /** Destinatario en la guía remitente. */
  cliente?: PartyInput;
  /** Guía transportista. */
  destinatario?: PartyInput;
  remitente?: Omit<PartyInput, "correo" | "celular">;
  datosTraslado: {
    fecha: string;
    pesoBrutoTotal: number;
    pesoUnidadMedida: "KGM" | "TNE";
    numeroBultos: number;
    indicadorDeEnvio?: string;
    /** Obligatoria con transporte público. */
    fechaEntregaBienes?: string;
  };
  datosTransportista?: Record<string, unknown>;
  datosVehiculo?: Record<string, unknown>;
  datosChofer?: Record<string, unknown> | Record<string, unknown>[];
  puntoPartida: PuntoInput;
  puntoLlegada: PuntoInput;
  items: GuiaItemInput[];
  documentosRelacionados?: { tipoDocumento: "01" | "03" | "09" | "31"; numeroDocumento: string }[];
}

export interface GuiaResumen {
  id: string | null;
  estado: string;
  serie: string;
  correlativo: string;
  tipo: "GUIA_REMISION" | "GUIA_TRANSPORTISTA";
}

/** Respuesta de `guias.enviar`. */
export interface EnvioGuia {
  estado: string;
  entorno: string;
  guia: GuiaResumen;
  sunat?: RespuestaSunat & { ticket: string | null; nombreArchivo: string | null };
  enlaces: { pdf?: string; xml?: string; cdr?: string; consulta?: string } | null;
  hash?: string | null;
  cadenaQr?: string | null;
}

/** Respuesta de `guias.consultar` y `guias.consultarTicket`: la guía completa. */
export interface ConsultaGuia {
  estado: string;
  entorno: string;
  guia: GuiaResumen & {
    fechaEmision: string;
    tipoTransporte: string | null;
    motivoTraslado: string | null;
    cliente: Record<string, string | null>;
    datosTraslado: Record<string, unknown> | null;
    datosTransportista: Record<string, unknown> | null;
    puntoPartida: { ubigeo: string | null; direccion: string | null };
    puntoLlegada: { ubigeo: string | null; direccion: string | null };
    items: { codigo: string; descripcion: string; unidadMedida: string; cantidad: number }[];
    documentosRelacionados: { tipoDocumento: string | null; numeroDocumento: string }[];
  };
  sunat: RespuestaSunat & { ticket: string | null; nombreArchivo: string | null };
  enlaces: { pdf?: string; xml?: string; cdr?: string };
  hash: string | null;
  cadenaQr: string | null;
}

export interface ListarGuiasParams {
  pagina?: number;
  limite?: number;
  fechaInicio?: string;
  fechaFin?: string;
  estado?: string;
  buscar?: string;
}

// Eventos y webhooks

export interface Evento {
  tipo: string;
  estado: string;
  [key: string]: unknown;
}

export interface ListarWebhooksParams {
  pagina?: number;
  limite?: number;
  estado?: "ok" | "error";
  evento?: WebhookEventoNombre;
}

export interface ListaWebhooks {
  total: number;
  pagina: number;
  porPagina: number;
  webhooks: Record<string, unknown>[];
}

export type WebhookEventoNombre =
  | "documento.sunat.respuesta"
  | "documento.anulado"
  | "documento.correo.enviado"
  | "documento.correo.fallido"
  | "guia.sunat.respuesta"
  | "documento.error";

/** Cuerpo que Facturalo envía a tu webhook. Los campos extra dependen del evento. */
export interface WebhookEvento {
  id: string;
  evento: WebhookEventoNombre;
  timestamp: string;
  entorno: Entorno;
  documento?: DocumentoResumen;
  guia?: GuiaResumen | { serie: string | null; correlativo: string | null };
  sunat?: RespuestaSunat;
  enlaces?: EnlacesDocumento;
  hash?: string | null;
  cadenaQr?: string | null;
  anulacion?: {
    estado: "ANULADA" | "EN_PROCESO";
    tipo: "RA" | "RC";
    resumen: string | null;
    ticket: string | null;
    motivo: string | null;
    fecha: string;
  };
  correo?: { email: string; estado: "enviado" | "fallido"; error: string | null };
  error?: { mensaje: string };
}

// Cuenta (token de usuario)

export interface EmpresaInput {
  ruc: string;
  nombre: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  /** Ubigeo del domicilio fiscal (6 dígitos). */
  codigoPostal: string;
  sunat: {
    solUsuario: string;
    solClave: string;
    /** API SUNAT: solo para guías de remisión y SIRE. */
    clientId?: string;
    clientSecret?: string;
  };
  logo?: string;
  logoTicket?: string;
  produccion?: boolean;
}

export interface EstablecimientoInput {
  nombre: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  codigoPostal: string;
  celular?: string;
  correo?: string;
  logo?: string;
}

export interface WebhookEventoConfig {
  evento: WebhookEventoNombre;
  activo: boolean;
}

/** Objetos de cuenta: se devuelven tal como los entrega la API. */
export type Empresa = Record<string, unknown> & { id: string; ruc: string; nombre: string };
export type Establecimiento = Record<string, unknown> & { id: string; nombre: string };
