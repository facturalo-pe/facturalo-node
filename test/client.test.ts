import { afterEach, describe, expect, it, vi } from "vitest";

import { FacturaloClient, FacturaloCuentaClient } from "../src/client.js";
import {
  FacturaloAuthenticationError,
  FacturaloConnectionError,
  FacturaloNotFoundError,
  FacturaloValidationError,
} from "../src/errors.js";
import type { DocumentoInput } from "../src/types.js";

const TOKEN = "sk_test_abc123";
const BASE = "https://example.test/api/v3";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const factura: DocumentoInput = {
  sunatTransaccion: "0101",
  tipoComprobante: "01",
  serie: "F001",
  correlativo: "1",
  fechaEmision: "2026-10-30",
  moneda: "PEN",
  formaPago: "CONTADO",
  cliente: { tipoDocumento: "6", numeroDocumento: "20000000001", denominacion: "EMPRESA S.A.C.", direccion: "AV. LIMA 123" },
  items: [{ unidadMedida: "NIU", descripcion: "SERVICIO", cantidad: 1, precioUnitario: 118, tipoIgv: "10" }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FacturaloClient", () => {
  it("rechaza un token que no es de empresa", () => {
    expect(() => new FacturaloClient({ token: "user_sk_abc" })).toThrow(/sk_test_/);
    expect(() => new FacturaloClient({ token: "kuti_test_abc" })).toThrow();
  });

  it("deduce el entorno del token", () => {
    expect(new FacturaloClient({ token: "sk_test_x" }).entorno).toBe("demo");
    expect(new FacturaloClient({ token: "sk_live_x" }).entorno).toBe("prod");
  });

  it("envía el token sin Bearer y el documento envuelto con webhook false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: "La Factura numero F001-00000001 ha sido aceptada",
        data: {
          estado: "ACEPTADA",
          entorno: "demo",
          documento: { id: "uuid-1", estado: "ACEPTADA", serie: "F001", correlativo: "00000001", tipo: "FACTURA" },
          sunat: { estado: "ACEPTADA", codigo: "0", mensaje: "ok", notas: [] },
          enlaces: { pdf: "https://x/uuid-1.pdf" },
          hash: "abc=",
          cadenaQr: "20601476551 | 01 | F001 | 00000001 | ... |",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new FacturaloClient({ token: TOKEN, baseUrl: BASE });
    const envio = await client.documentos.enviar(factura);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/documentos/enviar`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(TOKEN);
    expect(JSON.parse(init.body as string)).toEqual({ webhook: false, documento: factura });
    expect(envio.estado).toBe("ACEPTADA");
    expect(envio.documento.correlativo).toBe("00000001");
  });

  it("envía Idempotency-Key al emitir un documento", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: "ok",
        data: {
          estado: "ACEPTADA",
          entorno: "demo",
          documento: { id: "uuid-1", estado: "ACEPTADA", serie: "F001", correlativo: "00000001", tipo: "FACTURA" },
          sunat: { estado: "ACEPTADA", codigo: "0", mensaje: "ok", notas: [] },
          enlaces: { pdf: "https://x/uuid-1.pdf" },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new FacturaloClient({ token: TOKEN, baseUrl: BASE });
    await client.documentos.enviar(factura, { idempotencyKey: "orden-1042" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("orden-1042");
  });

  it("un rechazo de SUNAT no lanza: vuelve con estado RECHAZADA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          success: false,
          message: "El numero de RUC del receptor no existe",
          data: { estado: "RECHAZADA", sunat: { estado: "RECHAZADA", codigo: "2017", mensaje: "x", notas: [] } },
        }),
      ),
    );
    const envio = await new FacturaloClient({ token: TOKEN }).documentos.enviar(factura);
    expect(envio.estado).toBe("RECHAZADA");
    expect(envio.sunat?.codigo).toBe("2017");
  });

  it("mapea 422 a FacturaloValidationError con los errores por campo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(422, {
          success: false,
          message: "Los datos enviados no son válidos.",
          errors: { "documento.items": ["El campo items es requerido."] },
        }),
      ),
    );
    const promise = new FacturaloClient({ token: TOKEN }).documentos.enviar(factura);
    await expect(promise).rejects.toBeInstanceOf(FacturaloValidationError);
    await promise.catch((err: FacturaloValidationError) => {
      expect(err.status).toBe(422);
      expect(err.errors["documento.items"]).toEqual(["El campo items es requerido."]);
    });
  });

  it("mapea 401 y 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { success: false, message: "Token de autorización inválido." })));
    await expect(new FacturaloClient({ token: TOKEN }).documentos.consultar("x")).rejects.toBeInstanceOf(
      FacturaloAuthenticationError,
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { success: false, message: "No se encontró", data: [] })));
    await expect(new FacturaloClient({ token: TOKEN }).documentos.consultar("x")).rejects.toBeInstanceOf(
      FacturaloNotFoundError,
    );
  });

  it("reintenta las consultas ante 503 pero nunca un envío", async () => {
    const consulta = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { success: false, message: "busy" }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { estado: "ACEPTADA" } }));
    vi.stubGlobal("fetch", consulta);
    await new FacturaloClient({ token: TOKEN }).documentos.consultar("uuid-1");
    expect(consulta).toHaveBeenCalledTimes(2);

    const envio = vi.fn().mockResolvedValue(jsonResponse(503, { success: false, message: "busy" }));
    vi.stubGlobal("fetch", envio);
    await expect(new FacturaloClient({ token: TOKEN }).documentos.enviar(factura)).rejects.toThrow();
    expect(envio).toHaveBeenCalledTimes(1);
  });

  it("no reintenta un envío cuando falla la red", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new FacturaloClient({ token: TOKEN }).documentos.enviar(factura)).rejects.toBeInstanceOf(
      FacturaloConnectionError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("buscar y listar traducen los parámetros a los nombres de la API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, data: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new FacturaloClient({ token: TOKEN, baseUrl: BASE });

    await client.documentos.buscar({ tipoComprobante: "03", serie: "B001", correlativo: "12" });
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/documentos/buscar?tipo_documento=03&serie=B001&correlativo=12`);

    await client.documentos.listar({ pagina: 2, fechaInicio: "2026-10-01", estado: "ACEPTADA" });
    expect(fetchMock.mock.calls[1]![0]).toBe(`${BASE}/empresas/documentos?page=2&fecha_inicio=2026-10-01&estado=ACEPTADA`);
  });

  it("anular envuelve el cuerpo en documento", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true, data: { estado: "ANULADA" } }));
    vi.stubGlobal("fetch", fetchMock);
    const params = { tipoComprobante: "01" as const, serie: "F001", correlativo: "1", motivo: "Error en el monto" };
    const anulacion = await new FacturaloClient({ token: TOKEN }).documentos.anular(params);
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ documento: params });
    expect(anulacion.estado).toBe("ANULADA");
  });

  it("arma las URLs públicas de archivos", () => {
    const client = new FacturaloClient({ token: TOKEN, baseUrl: BASE });
    expect(client.documentos.urlArchivo("u1", "ticket")).toBe(`${BASE}/documentos/u1.ticket.pdf`);
    expect(client.guias.urlArchivo("g1", "cdr")).toBe(`${BASE}/guias/g1.cdr`);
  });
});

describe("FacturaloCuentaClient", () => {
  it("exige el token de usuario", () => {
    expect(() => new FacturaloCuentaClient({ token: "sk_test_abc" })).toThrow(/user_sk_/);
  });

  it("crear empresa devuelve el objeto empresa", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, { success: true, data: { empresa: { id: "e1", ruc: "20601476551", nombre: "MI EMPRESA" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const cuenta = new FacturaloCuentaClient({ token: "user_sk_abc", baseUrl: BASE });
    const empresa = await cuenta.empresas.crear({
      ruc: "20601476551",
      nombre: "MI EMPRESA",
      direccion: "AV. 1",
      departamento: "LIMA",
      provincia: "LIMA",
      distrito: "LIMA",
      codigoPostal: "150101",
      sunat: { solUsuario: "MODDATOS", solClave: "moddatos" },
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(`${BASE}/empresas`);
    expect(JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string).empresa.ruc).toBe("20601476551");
    expect(empresa.id).toBe("e1");
  });
});
