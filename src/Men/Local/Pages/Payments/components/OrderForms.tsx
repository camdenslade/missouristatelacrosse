import { useEffect, useReducer, useRef, useState } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";
import type { SavedSizes } from "../../../../../Global/Common/utils/sizeCategories";
import { apiRequest } from "../../../../../Services/API";

type Item = {
  id: string;
  name: string;
  description: string | null;
  firstYearComp?: boolean;
  sizeCategory?: string | null;
  price: number | null;
  image: string | null;
  options: string[];
};
type OrderForm = { id: string; title: string; description: string | null; items: Item[] };
type CartLine = { option: string; quantity: number };
type OrderLine = { itemId: string; name: string; option?: string; quantity: number; lineTotal?: number; waived?: boolean; waivedReason?: string };
type MySubmission = { id: string; selections: OrderLine[]; owed: number; createdAt: string };

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
    case "LOAD_CART":
      return { ...state, cart: { ...state.cart, ...(action.cart as Record<string, CartLine>) } };
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
  onSubmitted,
}: {
  playerId: string;
  focusFormId?: string | null;
  emptyMessage?: string;
  hideHeading?: boolean;
  onSubmitted?: () => void;
}) {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);
  const focusRef = useRef<HTMLDivElement | null>(null);
  const [firstYear, setFirstYear] = useState(false);
  const [savedSizes, setSavedSizes] = useState<SavedSizes>({});
  // Each player has one order per form; once placed it's shown as a summary they can change.
  const [mySubs, setMySubs] = useState<Record<string, MySubmission | null>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  const loadMySubmission = (formId: string) =>
    apiRequest<{ submission: MySubmission | null }>(`/api/order-forms/${formId}/my-submission?playerId=${playerId}`)
      .then((r) => setMySubs((prev) => ({ ...prev, [formId]: r?.submission ?? null })))
      .catch(() => setMySubs((prev) => ({ ...prev, [formId]: null })));

  const startChange = (formId: string, sub: MySubmission) => {
    const cart: Record<string, CartLine> = {};
    for (const line of sub.selections || []) {
      const prev = cart[line.itemId];
      cart[line.itemId] = { option: prev?.option || line.option || "", quantity: (prev?.quantity ?? 0) + line.quantity };
    }
    dispatch({ type: "LOAD_CART", cart });
    setEditing((e) => ({ ...e, [formId]: true }));
  };

  useEffect(() => {
    apiRequest<SavedSizes>(`/api/order-forms/sizes?playerId=${playerId}`)
      .then((s) => setSavedSizes(s || {}))
      .catch(() => setSavedSizes({}));
  }, [playerId]);

  // The player's saved size for this kind of item, if this item offers it.
  const savedOption = (item: Item) => {
    const size = item.sizeCategory ? savedSizes[item.sizeCategory] : undefined;
    return size && item.options?.includes(size) ? size : undefined;
  };

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
    if (state.loading) return;
    state.forms.forEach((f) => loadMySubmission(f.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loading, state.forms, playerId]);

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
    const updating = !!mySubs[form.id];
    const question = updating
      ? `Update your order? Your order total becomes $${total.toFixed(2)} and your balance is adjusted to match.`
      : `Submit this order for $${total.toFixed(2)}? It will be added to your balance.`;
    if ((total > 0 || (updating && Number(mySubs[form.id]?.owed) > 0)) && !(await confirm(question))) {
      return;
    }
    dispatch({ type: "SET_SUBMITTING", formId: form.id });
    try {
      await apiRequest(`/api/order-forms/${form.id}/submit`, {
        method: "POST",
        json: { playerId, selections },
      });
      dispatch({ type: "CLEAR_CART" });
      toast.success(updating ? "Order updated!" : "Order submitted!");
      setEditing((e) => ({ ...e, [form.id]: false }));
      loadMySubmission(form.id);
      apiRequest<SavedSizes>(`/api/order-forms/sizes?playerId=${playerId}`)
        .then((s) => setSavedSizes(s || {}))
        .catch(() => {});
      onSubmitted?.();
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
        const mine = mySubs[form.id];
        const showSummary = !!mine && !editing[form.id];
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

            {showSummary && mine ? (
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E0009]">Your Order</p>
                  <p className="text-xs text-gray-500">Placed {new Date(mine.createdAt).toLocaleDateString()}. You can change it while the form is open.</p>
                </div>
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {[...(mine.selections || [])]
                    .sort((a, b) => form.items.findIndex((i) => i.id === a.itemId) - form.items.findIndex((i) => i.id === b.itemId))
                    .map((line, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className={line.waived ? "text-gray-400 line-through" : "text-gray-800"}>
                          {line.quantity} x {line.name}
                          {line.option ? ` (${line.option})` : ""}
                        </span>
                        {line.waived ? (
                          <span className="text-[11px] font-semibold text-green-700">{line.waivedReason || "Waived"}</span>
                        ) : (
                          Number(line.lineTotal) > 0 && (
                            <span className="tabular-nums text-gray-600">${Number(line.lineTotal).toFixed(2)}</span>
                          )
                        )}
                      </li>
                    ))}
                </ul>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-extrabold text-gray-900 tabular-nums">${Number(mine.owed ?? 0).toFixed(2)}</p>
                  <button
                    onClick={() => startChange(form.id, mine)}
                    className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-[#5E0009]/40 hover:text-[#5E0009] transition"
                  >
                    Change Order
                  </button>
                </div>
              </div>
            ) : (
            <>
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
                                title={savedOption(item) === opt ? "Your saved size" : undefined}
                                className={`min-w-[2.5rem] px-3 py-1 rounded-full text-xs font-semibold border transition ${
                                  active
                                    ? "bg-[#5E0009] border-[#5E0009] text-white"
                                    : savedOption(item) === opt
                                      ? "bg-white border-[#5E0009]/50 text-[#5E0009] border-dashed"
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
                          onClick={() =>
                            dispatch({ type: "SET_LINE", itemId: item.id, quantity: quantity + 1, option: line?.option || savedOption(item) })
                          }
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
              <div className="flex items-center gap-2">
                {mine && (
                  <button
                    onClick={() => {
                      dispatch({ type: "CLEAR_CART" });
                      setEditing((e) => ({ ...e, [form.id]: false }));
                    }}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => handleSubmit(form)}
                  disabled={state.submitting === form.id || itemCount === 0}
                  className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm disabled:opacity-50"
                >
                  {state.submitting === form.id ? "Saving..." : mine ? "Update Order" : "Submit Order"}
                </button>
              </div>
            </footer>
            </>
            )}
          </section>
        );
      })}
    </div>
  );
}
