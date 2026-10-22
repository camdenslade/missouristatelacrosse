import { useEffect, useReducer, useRef, useState } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";
import { apiRequest } from "../../../../../Services/API";

type Item = {
  id: string;
  name: string;
  description: string | null;
  firstYearComp?: boolean;
  price: number | null;
  image: string | null;
  options: string[];
};
type OrderForm = { id: string; title: string; description: string | null; items: Item[] };
type CartLine = { option: string; quantity: number };

const initialState = { forms: [] as OrderForm[], loading: true, cart: {} as Record<string, CartLine>, submitting: null as string | null };

function reducer(state: typeof initialState, action: any) {
  switch (action.type) {
    case "SET_FORMS":
      return { ...state, forms: action.forms, loading: false };
    case "SET_LINE": {
      const cart = { ...state.cart };
      if (action.quantity <= 0) {
        delete cart[action.itemId];
      } else {
        cart[action.itemId] = { option: action.option ?? cart[action.itemId]?.option ?? "", quantity: action.quantity };
      }
      return { ...state, cart };
    }
    case "SET_OPTION": {
      const cart = { ...state.cart };
      const existing = cart[action.itemId] ?? { option: "", quantity: 1 };
      cart[action.itemId] = { ...existing, option: action.option };
      return { ...state, cart };
    }
    case "CLEAR_CART":
      return { ...state, cart: {} };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.formId };
    default:
      return state;
  }
}

export default function OrderForms({
  playerId,
  focusFormId,
  emptyMessage,
  hideHeading,
}: {
  playerId: string;
  focusFormId?: string | null;
  emptyMessage?: string;
  hideHeading?: boolean;
}) {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [firstYear, setFirstYear] = useState(false);

  useEffect(() => {
    apiRequest<{ firstYear: boolean }>(`/api/order-forms/first-year?playerId=${playerId}`)
      .then((r) => setFirstYear(!!r?.firstYear))
      .catch(() => setFirstYear(false));
  }, [playerId]);

  // First Year Comp: one unit of the item is free in a player's first season (the server
  // applies the same rule when the order is submitted).
  const compedUnits = (item: Item, quantity: number) => (firstYear && item.firstYearComp && quantity > 0 ? 1 : 0);

  useEffect(() => {
    apiRequest<OrderForm[]>("/api/order-forms/active")
      .then((forms) => dispatch({ type: "SET_FORMS", forms }))
      .catch(() => dispatch({ type: "SET_FORMS", forms: [] }));
  }, []);

  useEffect(() => {
    if (!state.loading && focusFormId) {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.loading, focusFormId]);

  if (state.loading) return null;
  if (state.forms.length === 0) {
    if (focusFormId) return <p className="text-sm text-gray-500">That order form is closed or no longer available.</p>;
    return emptyMessage ? <p className="text-sm text-gray-400 text-center py-8">{emptyMessage}</p> : null;
  }
  const linkedFormMissing = !!focusFormId && !state.forms.some((f) => f.id === focusFormId);

  const totalFor = (form: OrderForm) =>
    form.items.reduce((sum, item) => {
      const line = state.cart[item.id];
      if (!line) return sum;
      return sum + (item.price ?? 0) * (line.quantity - compedUnits(item, line.quantity));
    }, 0);

  const handleSubmit = async (form: OrderForm) => {
    const selections = Object.entries(state.cart)
      .filter(([itemId]) => form.items.some((i) => i.id === itemId))
      .map(([itemId, line]) => ({ itemId, option: line.option || undefined, quantity: line.quantity }));
    if (selections.length === 0) {
      toast.error("Pick at least one item first.");
      return;
    }
    const missingOption = form.items.find(
      (item) => item.options?.length > 0 && state.cart[item.id] && !state.cart[item.id].option
    );
    if (missingOption) {
      toast.error(`Pick a size or option for ${missingOption.name}.`);
      return;
    }
    const total = totalFor(form);
    if (total > 0 && !(await confirm(`Submit this order for $${total.toFixed(2)}? It will be added to your balance.`))) {
      return;
    }
    dispatch({ type: "SET_SUBMITTING", formId: form.id });
    try {
      await apiRequest(`/api/order-forms/${form.id}/submit`, {
        method: "POST",
        json: { playerId, selections },
      });
      dispatch({ type: "CLEAR_CART" });
      toast.success("Order submitted!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit order.");
    } finally {
      dispatch({ type: "SET_SUBMITTING", formId: null });
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeading && (
        <div className="inline-flex items-center gap-3 text-[#5E0009] text-xs font-semibold uppercase tracking-[0.2em]">
          <span className="h-px w-6 bg-[#5E0009]/40" />
          Order Forms
          <span className="h-px w-6 bg-[#5E0009]/40" />
        </div>
      )}
      {linkedFormMissing && (
        <p className="text-sm text-gray-500">That order form is closed or no longer available.</p>
      )}
      {state.forms.map((form) => {
        const total = totalFor(form);
        const focused = form.id === focusFormId;
        const itemCount = form.items.reduce((n, item) => n + (state.cart[item.id]?.quantity ?? 0), 0);
        return (
          <section
            key={form.id}
            ref={focused ? focusRef : undefined}
            className={`bg-white rounded-2xl shadow-sm overflow-hidden scroll-mt-24 border ${
              focused ? "border-[#5E0009] ring-2 ring-[#5E0009]/20" : "border-gray-100"
            }`}
          >
            <header className="relative bg-gradient-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] px-5 py-5 flex items-center gap-4">
              <img src="/missouri-state-white.png" alt="Mo State" className="h-14 w-14 object-contain shrink-0 drop-shadow" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Order Form</p>
                <h4 className="text-xl font-extrabold uppercase leading-tight text-white break-words">{form.title}</h4>
                {form.description && <p className="text-sm text-white/80 mt-1">{form.description}</p>}
              </div>
            </header>

            <div className="p-4 space-y-3">
              {form.items.map((item) => {
                const line = state.cart[item.id];
                const quantity = line?.quantity ?? 0;
                const selected = quantity > 0;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 transition ${
                      selected ? "border-[#5E0009]/40 bg-[#5E0009]/[0.03]" : "border-gray-100 bg-gray-50/60"
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="h-16 w-16 shrink-0 rounded-lg bg-white border border-gray-100 overflow-hidden flex items-center justify-center">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <img src="/missouri-state.png" alt="" className="h-10 w-10 object-contain opacity-30" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-gray-900 leading-snug">{item.name}</p>
                          {item.price != null && (
                            <p className="font-semibold text-gray-900 tabular-nums shrink-0">${item.price.toFixed(2)}</p>
                          )}
                        </div>
                        {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                        {item.firstYearComp && (
                          <span className="mt-1 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                            {firstYear ? "Free for you: First Year Comp" : "Free for first-year players"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      {item.options?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.options.map((opt) => {
                            const active = line?.option === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => dispatch({ type: "SET_OPTION", itemId: item.id, option: opt })}
                                className={`min-w-[2.5rem] px-3 py-1 rounded-full text-xs font-semibold border transition ${
                                  active
                                    ? "bg-[#5E0009] border-[#5E0009] text-white"
                                    : "bg-white border-gray-200 text-gray-700 hover:border-[#5E0009]/50"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span />
                      )}
                      <div className="flex items-center rounded-full border border-gray-200 bg-white">
                        <button
                          type="button"
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => dispatch({ type: "SET_LINE", itemId: item.id, quantity: quantity - 1, option: line?.option })}
                          disabled={quantity === 0}
                          className="h-8 w-8 rounded-full text-lg leading-none text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${item.name}`}
                          onClick={() => dispatch({ type: "SET_LINE", itemId: item.id, quantity: quantity + 1, option: line?.option })}
                          className="h-8 w-8 rounded-full text-lg leading-none text-[#5E0009] hover:bg-[#5E0009]/10"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="border-t border-gray-100 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                  {itemCount} item{itemCount === 1 ? "" : "s"}
                </p>
                <p className="text-lg font-extrabold text-gray-900 tabular-nums">${total.toFixed(2)}</p>
              </div>
              <button
                onClick={() => handleSubmit(form)}
                disabled={state.submitting === form.id || itemCount === 0}
                className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm disabled:opacity-50"
              >
                {state.submitting === form.id ? "Submitting..." : "Submit Order"}
              </button>
            </footer>
          </section>
        );
      })}
    </div>
  );
}
