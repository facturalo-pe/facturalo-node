import { createHmac, timingSafeEqual } from "node:crypto";

import { FacturaloSignatureVerificationError } from "./errors.js";
import type { WebhookEvento } from "./types.js";

/**
 * Verifica la firma de un webhook de Facturalo: recalcula `HMAC_SHA256(secret, body)` en hexadecimal
 * y lo compara en tiempo constante con el header `X-Facturalo-Firma`.
 *
 * Usa el cuerpo crudo tal como llegó (string o Buffer). Si tu framework ya lo parseó a JSON y lo
 * vuelves a serializar, un espacio de diferencia invalida la firma.
 *
 * @param payload Cuerpo crudo del request.
 * @param firma Valor del header `X-Facturalo-Firma`.
 * @param secret El secreto del webhook de la empresa (`whsec_...`), distinto por entorno.
 * @throws {FacturaloSignatureVerificationError} Si falta la firma o no coincide.
 */
export function verificarFirmaWebhook(payload: string | Buffer, firma: string | null | undefined, secret: string): void {
  if (!firma) {
    throw new FacturaloSignatureVerificationError("Falta el header X-Facturalo-Firma.");
  }
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(firma.trim().toLowerCase(), "hex");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new FacturaloSignatureVerificationError("La firma del webhook no coincide.");
  }
}

/** Verifica la firma y devuelve el evento ya parseado. */
export function construirEventoWebhook(
  payload: string | Buffer,
  firma: string | null | undefined,
  secret: string,
): WebhookEvento {
  verificarFirmaWebhook(payload, firma, secret);
  return JSON.parse(typeof payload === "string" ? payload : payload.toString("utf8")) as WebhookEvento;
}
