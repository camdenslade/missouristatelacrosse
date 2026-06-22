import { useState } from "react";
import AddParentForm from "./AddParentForm";
import type { ApiPlayer, DuesPayment, ParentLink } from "../../../../../types/api";

type PlayerPaymentDetailsProps = {
  userRole: string;
  selectedPlayer: ApiPlayer | null;
  addParentEmail: string;
  setAddParentEmail: (val: string) => void;
  handleAddParent: () => Promise<void> | void;
  handleRemoveParent: (email: string) => Promise<void> | void;
  message: string;
  customAmount: string;
  setCustomAmount: (val: string) => void;
  ledger: DuesPayment[];
  onAdminAdjust: (amount: number, type: "CHARGE" | "CREDIT", note: string) => Promise<void>;
};

const typeLabel: Record<string, { label: string; color: string; sign: string }> = {
  PAYMENT: { label: "Payment",    color: "text-green-600", sign: "−" },
  CREDIT:  { label: "Credit",     color: "text-green-600", sign: "−" },
  CHARGE:  { label: "Charge",     color: "text-red-600",   sign: "+" },
  ADJUSTMENT: { label: "Adjustment", color: "text-red-600", sign: "+" },
};

export default function PlayerPaymentDetails({
  userRole,
  selectedPlayer,
  addParentEmail,
  setAddParentEmail,
  handleAddParent,
  handleRemoveParent,
  message,
  customAmount,
  setCustomAmount,
  ledger,
  onAdminAdjust,
}: PlayerPaymentDetailsProps) {
  const balance = Number(selectedPlayer?.balance ?? 0);
  const parents: ParentLink[] = selectedPlayer?.parents || [];

  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"CHARGE" | "CREDIT">("CHARGE");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const handleAdjust = async () => {
    const val = parseFloat(adjustAmount);
    if (!val || val <= 0) return;
    setAdjusting(true);
    try {
      await onAdminAdjust(val, adjustType, adjustNote);
      setAdjustAmount("");
      setAdjustNote("");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b pb-3">
        <h2 className="text-xl font-semibold text-[#5E0009]">
          {selectedPlayer?.name || "Player"}
        </h2>
        <p className={`text-lg font-bold mt-1 ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
          Balance: ${balance.toFixed(2)}
          {balance <= 0 && <span className="ml-2 text-sm font-normal">✓ Paid up</span>}
        </p>
      </div>

      {/* Admin balance adjustment */}
      {userRole === "admin" && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-800 mb-3 text-sm">Adjust Balance</h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as "CHARGE" | "CREDIT")}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
            >
              <option value="CHARGE">Charge (increases balance)</option>
              <option value="CREDIT">Credit (reduces balance)</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-28"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 min-w-32"
            />
            <button
              onClick={handleAdjust}
              disabled={adjusting || !adjustAmount}
              className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm hover:bg-gray-900 disabled:opacity-50 transition"
            >
              {adjusting ? "Saving…" : "Apply"}
            </button>
          </div>
        </div>
      )}

      {/* Parent management */}
      {(userRole === "admin" || userRole === "player") && (
        <AddParentForm
          addParentEmail={addParentEmail}
          setAddParentEmail={setAddParentEmail}
          handleAddParent={handleAddParent}
          message={message}
        />
      )}

      {parents.length > 0 && (
        <div>
          <h3 className="font-medium mb-2 text-sm">Linked Parents</h3>
          <div className="space-y-1">
            {parents.map((parent, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                <span>{parent.email || "Unknown"}</span>
                {userRole === "admin" && (
                  <button
                    onClick={() => { if (parent.email) handleRemoveParent(parent.email); }}
                    disabled={!parent.email}
                    className="text-red-600 hover:text-red-800 text-xs"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment amount input */}
      <div>
        <label className="block font-medium mb-1 text-sm">Payment Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter amount"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="border px-3 py-2 rounded w-full"
        />
      </div>

      {/* Payment ledger */}
      {ledger.length > 0 && (
        <div>
          <h3 className="font-medium text-sm mb-2">Payment History</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Note</th>
                  <th className="text-right px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledger.map((entry) => {
                  const meta = typeLabel[entry.type] ?? { label: entry.type, color: "text-gray-700", sign: "" };
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className={`px-3 py-2 font-medium ${meta.color}`}>{meta.label}</td>
                      <td className="px-3 py-2 text-gray-600">{entry.note || "—"}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${meta.color}`}>
                        {meta.sign}${Number(entry.amount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
