import { useEffect, useReducer } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";
import { apiRequest } from "../../../../../Services/API";

type Item = {
  id: string;
  name: string;
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

export default function OrderForms({ playerId }: { playerId: string }) {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    apiRequest<OrderForm[]>("/api/order-forms/active")
      .then((forms) => dispatch({ type: "SET_FORMS", forms }))
      .catch(() => dispatch({ type: "SET_FORMS", forms: [] }));
  }, []);

  if (state.loading || state.forms.length === 0) return null;

  const totalFor = (form: OrderForm) =>
    form.items.reduce((sum, item) => {
      const line = state.cart[item.id];
      if (!line) return sum;
      return sum + (item.price ?? 0) * line.quantity;
    }, 0);

  const handleSubmit = async (form: OrderForm) => {
    const selections = Object.entries(state.cart)
      .filter(([itemId]) => form.items.some((i) => i.id === itemId))
      .map(([itemId, line]) => ({ itemId, option: line.option || undefined, quantity: line.quantity }));
    if (selections.length === 0) {
      toast.error("Pick at least one item first.");
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
      <h3 className="font-medium text-sm text-gray-800">Order Forms</h3>
      {state.forms.map((form) => {
        const total = totalFor(form);
        return (
          <div key={form.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
            <h4 className="font-semibold text-gray-900">{form.title}</h4>
            {form.description && <p className="text-sm text-gray-600 mt-1">{form.description}</p>}

            <div className="mt-3 space-y-3">
              {form.items.map((item) => {
                const line = state.cart[item.id];
                return (
                  <div key={item.id} className="flex items-center gap-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                    {item.image && (
                      <img src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover border border-gray-200 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 text-sm">{item.name}</p>
                      {item.price != null && <p className="text-xs text-gray-500">${item.price.toFixed(2)}</p>}
                      {item.options?.length > 0 && (
                        <select
                          value={line?.option ?? ""}
                          onChange={(e) => dispatch({ type: "SET_OPTION", itemId: item.id, option: e.target.value })}
                          className="mt-1 border border-gray-200 rounded-lg px-2 py-1 text-xs"
                        >
                          <option value="">Choose...</option>
                          {item.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={line?.quantity ?? 0}
                      onChange={(e) =>
                        dispatch({ type: "SET_LINE", itemId: item.id, quantity: parseInt(e.target.value, 10) || 0, option: line?.option })
                      }
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Total: ${total.toFixed(2)}</span>
              <button
                onClick={() => handleSubmit(form)}
                disabled={state.submitting === form.id}
                className="px-4 py-2 bg-[#5E0009] text-white rounded-full text-sm font-semibold hover:bg-[#7a0012] transition disabled:opacity-60"
              >
                {state.submitting === form.id ? "Submitting..." : "Submit Order"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
