# @facturalo-pe/node

SDK oficial de [Facturalo](https://www.facturalo.pe) para Node.js. Emite facturas, boletas, notas de crédito y débito y guías de remisión ante SUNAT, consulta RUC y DNI, trabaja el SIRE y verifica los webhooks.

Documentación completa de la API: [docs.facturalo.pe](https://docs.facturalo.pe).

```bash
npm install @facturalo-pe/node
```

Node 18 o superior. Solo para el servidor: usa tu token secreto, nunca lo importes en el navegador.

## Primera factura

Crea tu empresa en [console.facturalo.pe](https://console.facturalo.pe) y copia su token Demo (`sk_test_...`) desde el menú de la empresa, opción **Tokens**. El token decide el entorno: `sk_test_...` va a SUNAT beta y `sk_live_...` a producción.

```ts
import { FacturaloClient } from "@facturalo-pe/node";

const facturalo = new FacturaloClient({ token: process.env.FACTURALO_TOKEN! });

const envio = await facturalo.documentos.enviar({
  sunatTransaccion: "0101",
  tipoComprobante: "01",
  serie: "F001",
  correlativo: "1",
  fechaEmision: "2026-10-30",
  moneda: "PEN",
  formaPago: "CONTADO",
  cliente: {
    tipoDocumento: "6",
    numeroDocumento: "20000000001",
    denominacion: "EMPRESA S.A.C.",
    direccion: "AV. LIMA 123 - LIMA",
  },
  items: [
    // precioUnitario incluye IGV; Facturalo calcula el IGV y los totales.
    { unidadMedida: "NIU", descripcion: "SERVICIO DE CONSULTORÍA", cantidad: 1, precioUnitario: 118, tipoIgv: "10" },
  ],
});

if (envio.estado === "ACEPTADA") {
  console.log(envio.enlaces.pdf, envio.cadenaQr);
} else {
  console.log(envio.estado, envio.sunat?.codigo, envio.sunat?.mensaje);
}
```

Un rechazo de SUNAT no lanza excepción: llega con `estado: "RECHAZADA"` y el motivo en `sunat`. Las excepciones son para errores de la petición (validación, token, red).

La respuesta solo identifica el comprobante. El detalle completo (cliente, totales, ítems) se obtiene con `documentos.consultar(id)`.

## Sin esperar a SUNAT

```ts
const envio = await facturalo.documentos.enviar(documento, { webhook: true });
// envio.estado === "EN_PROCESO": el resultado llega a tu webhook como documento.sunat.respuesta
```

## Recursos

```ts
// Documentos (factura, boleta, notas)
await facturalo.documentos.enviar(documento, { webhook, establecimiento });
await facturalo.documentos.generarXml(documento);            // firma el XML sin enviarlo
await facturalo.documentos.consultar(id);                    // detalle completo + estado
await facturalo.documentos.buscar({ tipoComprobante: "01", serie: "F001", correlativo: "1" });
await facturalo.documentos.listar({ fechaInicio: "2026-10-01", estado: "ACEPTADA", pagina: 1 });
await facturalo.documentos.anular({ tipoComprobante: "01", serie: "F001", correlativo: "1", motivo: "Error en el monto" });
await facturalo.documentos.reenviar(id);
await facturalo.documentos.eventos(id);
await facturalo.documentos.eliminar(id);                     // solo NO_ENVIADA
const pdf = await facturalo.documentos.descargar(id, "pdf"); // devuelve un Buffer; también "ticket", "xml" o "cdr"

// Guías de remisión (serie T... remitente, V... transportista)
await facturalo.guias.enviar(guia, { webhook });
await facturalo.guias.consultar(id);
await facturalo.guias.consultarTicket(ticket);
await facturalo.guias.listar({ pagina: 1 });

// Consultas
await facturalo.consultas.ruc("20601476551");
await facturalo.consultas.dni("12345678");
await facturalo.consultas.tipoCambio("2026-10-30");

// Webhooks enviados
await facturalo.webhooks.listar({ estado: "error" });
await facturalo.webhooks.reenviar(eventoId);

// SIRE (periodo YYYYMM)
await facturalo.sire.ventas.resumen("202610");
await facturalo.sire.compras.comprobantes("202610", { page: 1, perPage: 100 });
```

## Recibir webhooks

Facturalo firma cada webhook con `HMAC-SHA256(secret, cuerpo)` en el header `X-Facturalo-Firma`. Verifica siempre con el **cuerpo crudo**:

```ts
import express from "express";
import { construirEventoWebhook, FacturaloSignatureVerificationError } from "@facturalo-pe/node";

app.post("/webhooks/facturalo", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const evento = construirEventoWebhook(req.body, req.header("X-Facturalo-Firma"), process.env.FACTURALO_WEBHOOK_SECRET!);
    if (evento.evento === "documento.sunat.respuesta") {
      // evento.documento.id, evento.sunat.estado, evento.enlaces.pdf...
    }
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof FacturaloSignatureVerificationError) return res.sendStatus(401);
    throw err;
  }
});
```

El secreto (`whsec_...`) está en la consola, el menú de la empresa, opción **Webhooks**, y es distinto en Demo y Live.

## Cuenta: empresas y establecimientos

Con el token de usuario (`user_sk_...`) puedes dar de alta empresas desde tu propio software:

```ts
import { FacturaloCuentaClient } from "@facturalo-pe/node";

const cuenta = new FacturaloCuentaClient({ token: process.env.FACTURALO_USER_TOKEN! });
const empresa = await cuenta.empresas.crear({ ruc, nombre, direccion, departamento, provincia, distrito, codigoPostal, sunat: { solUsuario, solClave } });
await cuenta.empresas.actualizarWebhook(empresa.id, { demo: "https://mi-sistema.pe/webhooks/facturalo" });
await cuenta.establecimientos.crear(empresa.id, { nombre, direccion, departamento, provincia, distrito, codigoPostal });
```

## Errores

| Excepción | Cuándo |
|---|---|
| `FacturaloValidationError` | 400 / 422. `err.errors` trae los errores por campo |
| `FacturaloAuthenticationError` | 401: token inválido o regenerado |
| `FacturaloNotFoundError` | 404: no existe en este entorno |
| `FacturaloRateLimitError` | 429 |
| `FacturaloConnectionError` | Red o timeout (default 90 s) |
| `FacturaloApiError` | Clase base de las anteriores, con `status` y `body` |

Las consultas (`GET`) se reintentan solas ante 429/5xx y fallos de red. Los envíos nunca se reintentan automáticamente, para no emitir dos veces el mismo comprobante.

## Licencia

MIT © Consultia Digital S.A.C. (Facturalo)
