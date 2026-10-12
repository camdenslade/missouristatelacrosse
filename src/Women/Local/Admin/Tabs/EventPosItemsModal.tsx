import { useEffect, useReducer } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import Modal from "../../../../Global/Common/Modal";
import { apiRequest } from "../../../../Services/API";

const blankForm = { name: "", price: "" };

const initialState = {
  items: [],
  sales: null,
  loading: true,
  form: blankForm,
  saving: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_DATA":
      return { ...state, items: action.items, sales: action.sales, loading: false };
    case "SET_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "RESET_FORM":
      return { ...state, form: blankForm };
    case "SET_SAVING":
      return { ...state, saving: action.payload };
    case "REMOVE":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    default:
      return state;
  }
}

export default function EventPosItemsModal({ eventId, eventName, onClose }) {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, initialState);

  const load = () => {
    Promise.all([
      apiRequest(`/api/events/${eventId}/pos-items`).catch(() => []),
      apiRequest(`/api/events/${eventId}/pos-sales`).catch(() => null),
    ]).then(([items, sales]) => dispatch({ type: "SET_DATA", items, sales }));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const price = parseFloat(state.form.price);
    if (!state.form.name.trim() || isNaN(price) || price <= 0) {
      toast.error("Name and a positive price are required.");
      return;
    }
    dispatch({ type: "SET_SAVING", payload: true });
    try {
      await apiRequest(`/api/events/${eventId}/pos-items`, {
        method: "POST",
        json: { name: state.form.name.trim(), price },
      });
      dispatch({ type: "RESET_FORM" });
      load();
      toast.success("Item added.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add item.");
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Remove this item?"))) return;
    try {
      await apiRequest(`/api/events/pos-items/${id}`, { method: "DELETE" });
      dispatch({ type: "REMOVE", id });
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove.");
    }
  };

  const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30";

  return (
    <Modal onClose={onClose} size="lg">
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-gray-900">POS Items - {eventName}</h3>
        <p className="text-sm text-gray-500">
          These show up as tappable buttons in the Tap to Pay app when this event is selected,
          instead of staff typing an amount.
        </p>

        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Item name</label>
            <input
              type="text"
              placeholder="Water"
              value={state.form.name}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })}
              className={`${input} w-32`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Price ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="2.00"
              value={state.form.price}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "price", value: e.target.value })}
              className={`${input} w-24`}
            />
          </div>
          <button
            type="submit"
            disabled={state.saving}
            className="px-4 py-2 bg-[#5E0009] text-white rounded-lg text-sm font-medium hover:bg-[#7a0012] transition disabled:opacity-60"
          >
            {state.saving ? "Adding..." : "Add"}
          </button>
        </form>

        {!state.loading && state.items.length > 0 && (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {state.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-800">{item.name} - ${Number(item.price).toFixed(2)}</span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {!state.loading && state.items.length === 0 && (
          <p className="text-sm text-gray-400">No items yet - add some above.</p>
        )}

        {state.sales && (
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-gray-700 mb-2">
              Sales so far: {state.sales.saleCount} sale{state.sales.saleCount === 1 ? "" : "s"},
              {" "}${Number(state.sales.grandTotal).toFixed(2)} total
            </h4>
            {state.sales.items.length > 0 ? (
              <ul className="text-sm text-gray-600 space-y-1">
                {state.sales.items.map((i) => (
                  <li key={i.name}>
                    {i.name}: {i.quantitySold} sold - ${Number(i.revenue).toFixed(2)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No itemized sales yet.</p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-300 transition">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
