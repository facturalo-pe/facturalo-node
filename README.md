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

## Exonerada en la Amazonía (Ley 27037)

Empresas de la Amazonía que venden para consumo en la misma región: ítems con `tipoIgv: "20"` y `amazonia`, que agrega la leyenda de SUNAT (`"bienes"` → 2001, `"servicios"` → 2002, `"construccion"` → 2003). Sirve en facturas y boletas.

```ts
await facturalo.documentos.enviar({
  ...documento,
  amazonia: "bienes",
  items: [{ unidadMedida: "NIU", descripcion: "ARROZ COSTEÑO 5KG", cantidad: 10, precioUnitario: 25, tipoIgv: "20" }],
});
```

Sin ningún ítem exonerado la API responde 422 (SUNAT lo rechazaría con 3283/3284/3285).

## Percepción, retención, otros cargos y dólares

```ts
// Percepción del IGV (51 = 2%, 52 = 1%, 53 = 0.5%): solo al contado, en facturas y boletas.
// Facturalo pone la operación 2001 y calcula la percepción en soles.
await facturalo.documentos.enviar({ ...documento, percepcion: { tipo: "51" } });

// Retención del IGV (código 62, 3%): solo facturas a un cliente con RUC.
await facturalo.documentos.enviar({ ...documento, retencion: { tipo: "62", porcentaje: 3 } });

// Otros cargos globales (código 50): no forman parte de la base del IGV y se suman al total.
await facturalo.documentos.enviar({ ...documento, totalOtrosCargos: 15 });

// En dólares con bolsas (ICBPER) o percepción, envía el tipo de cambio.
await facturalo.documentos.enviar({ ...documento, moneda: "USD", tipoCambio: 3.75 });
```

- Percepción, retención y detracción no se combinan entre sí: la API responde 422.
- Al crédito con cliente RUC, las `cuotas` deben sumar total + ICBPER + otros cargos − anticipos − detracción − retención.
- `tipoIgv: "17"` es IVAP (arroz pilado, 4%): ese comprobante solo lleva ítems con IVAP.
- El ISC todavía no se emite por la API: `totalIsc` mayor a 0 responde 422.

## Sin esperar a SUNAT

```ts
const envio = await facturalo.documentos.enviar(documento, {
  webhook: true,
  idempotencyKey: "orden-1042", // evita duplicar si reintentas el POST
});
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
// Código de producto SUNAT para un ítem, por su descripción
await facturalo.consultas.codigoProductoSunat("laptop core i5", { limite: 3 });

// Webhooks enviados
await facturalo.webhooks.listar({ estado: "error" });
await facturalo.webhooks.reenviar(eventoId);
// Si tu endpoint no responde 2xx, Facturalo reintenta el webhook hasta 5 veces.

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
| `FacturaloPermissionError` | 403: el token no puede hacer esto. `err.code` dice por qué (p. ej. `PLAN_SIN_API`) |
| `FacturaloNotFoundError` | 404: no existe en este entorno |
| `FacturaloRateLimitError` | 429 |
| `FacturaloConnectionError` | Red o timeout (default 90 s) |
| `FacturaloApiError` | Clase base de las anteriores, con `status`, `code` y `body`. Los 402 de plan llegan como esta clase |

Errores de plan (`err.code`):

| `code` | HTTP | Qué significa |
|---|---|---|
| `PLAN_SIN_API` | 403 | El plan Gratis no incluye la API de producción (`sk_live_`). Está incluida en los planes de pago de Facturalo ERP (Básico, Pro, Negocio) y en los de Facturalo API. En demo (`sk_test_`) la API funciona en todos los planes |
| `PLAN_SOLO_API` | 403 | Tu plan API no incluye los módulos de negocio (inventario, compras, cajas...) |
| `CLAVE_SOLO_WOOCOMMERCE` | 403 | La clave del plugin de WooCommerce solo sirve para emitir y consultar un comprobante |
| `BILLING_REQUIRED` / `BILLING_SUSPENDED` | 402 | Sin plan activo, o pendiente de pago |
| `QUOTA_EXCEEDED` / `SALDO_INSUFICIENTE` | 402 | Se usó el cupo del mes y no hay saldo |
| `PLAN_SIN_GUIAS` | 402 | El plan no incluye guías de remisión |
| `PLAN_NO_DISPONIBLE` | 422 | Una empresa con plan de Facturalo ERP intentó contratar un plan de Facturalo API (su plan de pago ya incluye la API) |

```ts
import { FacturaloPermissionError } from "@facturalo-pe/node";

try {
  await facturalo.documentos.enviar(documento);
} catch (err) {
  if (err instanceof FacturaloPermissionError && err.code === "PLAN_SIN_API") {
    // Elige un plan Básico, Pro o Negocio en console.facturalo.pe/plan/planes
  }
  throw err;
}
```

Las consultas (`GET`) se reintentan solas ante 429/5xx y fallos de red. Los envíos nunca se reintentan automáticamente, para no emitir dos veces el mismo comprobante.

## Licencia

MIT © Consultia Digital S.A.C. (Facturalo)
