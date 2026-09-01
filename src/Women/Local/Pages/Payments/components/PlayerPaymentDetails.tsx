import { ChevronDown } from "lucide-react";
import { useState } from "react";

import AddParentForm from "./AddParentForm";
import type { ApiPlayer, DuesPayment, ParentLink } from "../../../../../types/api";

type PlayerPaymentDetailsProps = {
  userRole: string;
  selectedPlayer: ApiPlayer | null;
  addParentEmail: string;
  setAddParentEmail: (val: string) => void;
  addParentName: string;
  setAddParentName: (val: string) => void;
  handleAddParent: () => Promise<void> | void;
  handleLinkExistingParent: () => Promise<void> | void;
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

// Ledger entries come back newest-first. Balance and CREDIT/PAYMENT reduce balance,
// CHARGE/ADJUSTMENT increase it (mirrors DuesPaymentController's switch) - walk
// backwards from the player's current balance to reconstruct the balance immediately
// after each historical entry, so the table reads like a real running-balance receipt.
function withRunningBalance(ledger: DuesPayment[], currentBalance: number): Array<DuesPayment & { balanceAfter: number }> {
  let running = currentBalance;
  return ledger.map((entry, i) => {
    if (i > 0) {
      const prev = ledger[i - 1];
      const effect = prev.type === "CHARGE" || prev.type === "ADJUSTMENT" ? Number(prev.amount) : -Number(prev.amount);
      running = running - effect;
    }
    return { ...entry, balanceAfter: running };
  });
}

export default function PlayerPaymentDetails({
  userRole,
  selectedPlayer,
  addParentEmail,
  setAddParentEmail,
  addParentName,
  setAddParentName,
  handleAddParent,
  handleLinkExistingParent,
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
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <h2 className="text-xl font-semibold text-[#5E0009]">
          {selectedPlayer?.name || "Player"}
        </h2>
        <p className={`text-lg font-bold mt-1 ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
          Balance: ${balance.toFixed(2)}
          {balance <= 0 && <span className="ml-2 text-sm font-normal">Paid up</span>}
        </p>
      </div>

      {/* Admin balance adjustment */}
      {userRole === "admin" && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <h3 className="font-medium text-gray-800 mb-3 text-sm">Adjust Balance</h3>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <select
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as "CHARGE" | "CREDIT")}
                className="appearance-none border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition cursor-pointer"
              >
                <option value="CHARGE">Charge (increases balance)</option>
                <option value="CREDIT">Credit (reduces balance)</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="border border-gray-200 rounded-full px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
            />
            <input
              type="text"
              placeholder="Note (optional)"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              className="border border-gray-200 rounded-full px-3 py-1.5 text-sm flex-1 min-w-32 focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
            />
            <button
              onClick={handleAdjust}
              disabled={adjusting || !adjustAmount}
              className="px-4 py-1.5 bg-[#5E0009] text-white rounded-full text-sm font-semibold hover:bg-[#7a0012] disabled:opacity-50 transition"
            >
              {adjusting ? "Saving…" : "Apply"}
            </button>
          </div>
        </div>
      )}

      {/* Parent management */}
      {(userRole === "admin" || userRole === "player") && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <AddParentForm
            addParentEmail={addParentEmail}
            setAddParentEmail={setAddParentEmail}
            addParentName={addParentName}
            setAddParentName={setAddParentName}
            handleAddParent={handleAddParent}
            handleLinkExistingParent={handleLinkExistingParent}
            isAdmin={userRole === "admin"}
            playerName={selectedPlayer?.name}
            excludeUid={selectedPlayer?.userUid}
            message={message}
          />
        </div>
      )}

      {parents.length > 0 && (
        <div>
          <h3 className="font-medium mb-2 text-sm text-gray-800">Linked Parents</h3>
          <div className="space-y-1.5">
            {parents.map((parent, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm text-sm">
                <span>{parent.email || "Unknown"}</span>
                {userRole === "admin" && (
                  <button
                    onClick={() => { if (parent.email) handleRemoveParent(parent.email); }}
                    disabled={!parent.email}
                    className="text-red-600 hover:text-red-800 text-xs font-semibold"
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
        <label className="block font-medium mb-1 text-sm text-gray-800">Payment Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Enter amount"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="border border-gray-200 px-3 py-2 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
        />
      </div>

      {/* Payment ledger */}
      {ledger.length > 0 && (
        <div>
          <h3 className="font-medium text-sm mb-2 text-gray-800">Payment History</h3>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Note</th>
                  {userRole === "admin" && <th className="text-left px-3 py-2">Payment Ref</th>}
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-right px-3 py-2">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withRunningBalance(ledger, balance).map((entry) => {
                  const meta = typeLabel[entry.type] ?? { label: entry.type, color: "text-gray-700", sign: "" };
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {entry.createdAt
                          ? new Date(entry.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : " - "}
                      </td>
                      <td className={`px-3 py-2 font-medium ${meta.color}`}>{meta.label}</td>
                      <td className="px-3 py-2 text-gray-600">{entry.note || " - "}</td>
                      {userRole === "admin" && (
                        <td className="px-3 py-2 text-gray-400 font-mono" title={entry.payPalOrderId || undefined}>
                          {entry.payPalOrderId ? `${entry.payPalOrderId.slice(0, 10)}…` : " - "}
                        </td>
                      )}
                      <td className={`px-3 py-2 text-right font-semibold ${meta.color}`}>
                        {meta.sign}${Number(entry.amount).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        ${entry.balanceAfter.toFixed(2)}
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
