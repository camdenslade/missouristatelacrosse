// src/Global/Common/hooks/usePaymentProvider.ts
import { getActiveProgram } from "../../../Services/programHelper";

export type PaymentProvider = "paypal" | "stripe";

/**
 * Which payment rail the site should render, chosen per program via the same
 * build-time env-var convention as VITE_TEAMSTORE_ENABLED / VITE_DONATE_ENABLED:
 *
 *   VITE_PAYMENT_PROVIDER        -> men
 *   VITE_PAYMENT_PROVIDER_WOMEN  -> women
 *
 * Anything other than "stripe" (including unset) falls back to PayPal, so the site
 * keeps working if the var is missing or misspelled.
 */
export function resolvePaymentProvider(): PaymentProvider {
  const program = getActiveProgram();
  const raw =
    program === "women"
      ? import.meta.env.VITE_PAYMENT_PROVIDER_WOMEN
      : import.meta.env.VITE_PAYMENT_PROVIDER;
  return String(raw).trim().toLowerCase() === "stripe" ? "stripe" : "paypal";
}

/** Hook form for use inside components. It is a pure read of build-time config. */
export default function usePaymentProvider(): PaymentProvider {
  return resolvePaymentProvider();
}
