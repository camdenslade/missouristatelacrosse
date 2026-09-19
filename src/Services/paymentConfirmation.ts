import { apiRequest } from "./API";

export type ConfirmationKind = "order" | "donation" | "fundraiser";

const RETRIES = 4;
const RETRY_DELAY_MS = 2500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks the server to email the payer a confirmation for a completed payment. The server picks the
 * recipient and content from its own payment record, so this only names the payment and the
 * wording. A payment that is not marked complete yet (a card payment whose confirmation is still
 * arriving) is retried briefly. Never throws: a missing confirmation email must not break the
 * success page.
 */
export async function sendPaymentConfirmation(orderId: string | undefined | null, kind: ConfirmationKind) {
  if (!orderId) return;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      await apiRequest("/api/email/payment-confirmation", {
        method: "POST",
        json: { orderId, kind },
      });
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const notReadyYet = /^API (404|409)/.test(message);
      if (!notReadyYet || attempt === RETRIES - 1) {
        console.warn("Confirmation email not sent:", message);
        return;
      }
      await sleep(RETRY_DELAY_MS);
    }
  }
}
