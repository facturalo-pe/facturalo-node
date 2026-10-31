import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { FacturaloSignatureVerificationError } from "../src/errors.js";
import { construirEventoWebhook, verificarFirmaWebhook } from "../src/webhooks.js";

const SECRET = "whsec_test_1234567890";

// Igual que el backend: hash_hmac('sha256', json_encode($body), $secret).
function firmar(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

const body = JSON.stringify({
  id: "evt-1",
  evento: "documento.sunat.respuesta",
  timestamp: "2026-10-30T10:30:00-05:00",
  entorno: "demo",
  documento: { id: "uuid-1", estado: "ACEPTADA", serie: "F001", correlativo: "00000001", tipo: "FACTURA" },
});

describe("verificarFirmaWebhook", () => {
  it("acepta una firma calculada como en el servidor", () => {
    expect(() => verificarFirmaWebhook(body, firmar(SECRET, body), SECRET)).not.toThrow();
    expect(() => verificarFirmaWebhook(Buffer.from(body), firmar(SECRET, body), SECRET)).not.toThrow();
  });

  it("rechaza otro secreto", () => {
    expect(() => verificarFirmaWebhook(body, firmar("otro", body), SECRET)).toThrow(FacturaloSignatureVerificationError);
  });

  it("rechaza un cuerpo alterado", () => {
    const firma = firmar(SECRET, body);
    expect(() => verificarFirmaWebhook(body.replace("ACEPTADA", "RECHAZADA"), firma, SECRET)).toThrow(
      FacturaloSignatureVerificationError,
    );
  });

  it("rechaza si falta la firma o no es hexadecimal", () => {
    expect(() => verificarFirmaWebhook(body, undefined, SECRET)).toThrow(/X-Facturalo-Firma/);
    expect(() => verificarFirmaWebhook(body, "no-es-hex", SECRET)).toThrow(FacturaloSignatureVerificationError);
  });
});

describe("construirEventoWebhook", () => {
  it("devuelve el evento parseado si la firma es válida", () => {
    const evento = construirEventoWebhook(body, firmar(SECRET, body), SECRET);
    expect(evento.evento).toBe("documento.sunat.respuesta");
    expect(evento.documento?.estado).toBe("ACEPTADA");
  });
});
