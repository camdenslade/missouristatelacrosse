import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../Global/Common/components/ConfirmModal";
import Modal from "../../../../Global/Common/Modal";
import { apiRequest } from "../../../../Services/API";

type Row = { player_id: string; name: string; contacts: number; emailed: number; donations: number; raised: number };
type Board = { enabled: boolean; launchAt: string | number | null; players: Row[] };

const CONTACT_GOAL = 20;

function toLocalInput(value: string | number | null): string {
  if (value == null) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Board controls for running a campaign through players: launch time, send now, and who's done their part.
export default function FundraiserOutreachPanel({
  fundraiserId,
  title,
  onClose,
}: {
  fundraiserId: string;
  title: string;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const [board, setBoard] = useState<Board | null>(null);
  const [launchInput, setLaunchInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiRequest<Board>(`/api/fundraisers/outreach/${fundraiserId}/board`)
      .then((b) => {
        setBoard(b);
        setLaunchInput(toLocalInput(b.launchAt));
      })
      .catch(() => toast.error("Failed to load outreach."));
  }, [fundraiserId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: { enabled?: boolean; launchAt?: string }) => {
    setBusy(true);
    try {
      await apiRequest(`/api/fundraisers/outreach/${fundraiserId}/settings`, { method: "PUT", json: patch });
      load();
      toast.success("Saved.");
    } catch {
      toast.error("Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  const sendNow = async () => {
    if (!(await confirm("Launch now? Every contact that hasn't been emailed yet gets the ask right away."))) return;
    setBusy(true);
    try {
      const { sent } = await apiRequest<{ sent: number }>(`/api/fundraisers/outreach/${fundraiserId}/send-now`, { method: "POST" });
      toast.success(`Sent ${sent} email${sent === 1 ? "" : "s"}.`);
      load();
    } catch {
      toast.error("Failed to send.");
    } finally {
      setBusy(false);
    }
  };

  const players = board?.players ?? [];
  const totalContacts = players.reduce((n, p) => n + Number(p.contacts), 0);
  const totalRaised = players.reduce((n, p) => n + Number(p.raised), 0);
  const atGoal = players.filter((p) => Number(p.contacts) >= CONTACT_GOAL).length;
  const launched = board?.launchAt != null && new Date(board.launchAt).getTime() <= Date.now();

  return (
    <Modal onClose={onClose} size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E0009]">Player Outreach</p>
          <h3 className="text-xl font-extrabold uppercase text-gray-900 leading-tight">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">
            Players add contacts and get a share link in their Portal. The site emails each contact on launch, then two
            reminders four days apart to anyone who hasn't given.
          </p>
        </div>

        {!board ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!board.enabled}
                  disabled={busy}
                  onChange={(e) => save({ enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#5E0009]"
                />
                <span className="text-sm font-semibold text-gray-800">Run this campaign through players</span>
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Launch</span>
                  <input
                    type="datetime-local"
                    value={launchInput}
                    onChange={(e) => setLaunchInput(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009]"
                  />
                </label>
                <button
                  disabled={busy || !launchInput}
                  onClick={() => save({ launchAt: new Date(launchInput).toISOString() })}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:border-[#5E0009]/40 hover:text-[#5E0009] disabled:opacity-50"
                >
                  Save launch time
                </button>
                <button
                  disabled={busy || !board.enabled}
                  onClick={sendNow}
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-[#5E0009] text-white hover:bg-[#7a0012] shadow-sm disabled:opacity-50"
                >
                  {launched ? "Send due emails now" : "Launch now"}
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {launched ? "Live. New contacts are emailed within about 10 minutes." : "Nothing is emailed until the launch time."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Raised", value: `$${totalRaised.toFixed(0)}` },
                { label: "Contacts", value: String(totalContacts) },
                { label: `At ${CONTACT_GOAL}+`, value: `${atGoal} / ${players.length}` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{s.label}</p>
                  <p className="text-xl font-extrabold text-gray-900 tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto max-h-[45vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4">Player</th>
                    <th className="py-2 pr-3 text-right">Contacts</th>
                    <th className="py-2 pr-3 text-right">Emailed</th>
                    <th className="py-2 pr-3 text-right">Gifts</th>
                    <th className="py-2 text-right">Raised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...players]
                    .sort((a, b) => Number(b.raised) - Number(a.raised) || Number(b.contacts) - Number(a.contacts))
                    .map((p) => (
                      <tr key={p.player_id}>
                        <td className="py-2 pr-4 font-medium text-gray-900 whitespace-nowrap">{p.name}</td>
                        <td className={`py-2 pr-3 text-right tabular-nums ${Number(p.contacts) >= CONTACT_GOAL ? "text-green-700 font-semibold" : Number(p.contacts) === 0 ? "text-red-500" : ""}`}>
                          {p.contacts}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.emailed}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{p.donations}</td>
                        <td className="py-2 text-right tabular-nums">${Number(p.raised).toFixed(0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-full text-sm font-semibold hover:bg-gray-300 transition">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
