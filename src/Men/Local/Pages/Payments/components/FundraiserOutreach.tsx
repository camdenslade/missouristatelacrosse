import { Copy, MessageSquare, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useConfirm } from "../../../../../Global/Common/components/ConfirmModal";
import { apiRequest } from "../../../../../Services/API";

export type OutreachCampaign = { id: string; title: string; slug: string; goal_amount: number | null; outreach_launch_at: string | number | null };

type Contact = {
  id: string;
  name: string | null;
  email: string;
  emails_sent: number;
  donated: boolean;
  unsubscribed: boolean;
};

type Me = {
  code: string;
  shareUrl: string;
  contacts: Contact[];
  raised: number;
  launchAt: string | number | null;
  maxContacts: number;
};

const CONTACT_GOAL = 20;

// Accepts one contact per line: "Name, email", "Name <email>", or just an email.
function parseContacts(text: string): Array<{ name: string; email: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/);
      const email = match ? match[0] : "";
      const name = line.replace(email, "").replace(/[<>,;]/g, " ").replace(/\s+/g, " ").trim();
      return { name, email };
    })
    .filter((c) => c.email);
}

export default function FundraiserOutreach({ playerId, campaign }: { playerId: string; campaign: OutreachCampaign }) {
  const confirm = useConfirm();
  const [me, setMe] = useState<Me | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    apiRequest<Me>(`/api/fundraisers/outreach/${campaign.id}/me?playerId=${playerId}`)
      .then(setMe)
      .catch(() => setMe(null));
  }, [campaign.id, playerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!me) return <p className="text-sm text-gray-400 text-center py-8 animate-pulse">Loading fundraiser...</p>;

  const launch = me.launchAt != null ? new Date(me.launchAt) : null;
  const launched = !!launch && launch.getTime() <= Date.now();
  const textMessage = `Hey! I'm raising money for Missouri State Lacrosse (${campaign.title}). Anything helps, even $10: ${me.shareUrl}`;
  const pct = Math.min((me.contacts.length / CONTACT_GOAL) * 100, 100);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      window.prompt(`Copy your ${label.toLowerCase()}:`, value);
    }
  };

  const handleAdd = async () => {
    const contacts = parseContacts(draft);
    if (contacts.length === 0) {
      toast.error("Add at least one email address.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<{ added: number; skipped: string[] }>(
        `/api/fundraisers/outreach/${campaign.id}/contacts?playerId=${playerId}`,
        { method: "POST", json: contacts }
      );
      if (result.added) toast.success(`Added ${result.added} contact${result.added === 1 ? "" : "s"}.`);
      if (result.skipped.length) toast.error(`Skipped: ${result.skipped.join("; ")}`, { duration: 8000 });
      setDraft("");
      load();
    } catch {
      toast.error("Failed to add contacts.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (contact: Contact) => {
    if (!(await confirm(`Remove ${contact.email}?`))) return;
    try {
      await apiRequest(`/api/fundraisers/outreach/${campaign.id}/contacts/${contact.id}?playerId=${playerId}`, { method: "DELETE" });
      load();
    } catch {
      toast.error("Failed to remove.");
    }
  };

  const status = (c: Contact) =>
    c.donated
      ? { label: "Donated", cls: "bg-green-50 text-green-700" }
      : c.unsubscribed
        ? { label: "Unsubscribed", cls: "bg-gray-100 text-gray-500" }
        : c.emails_sent > 0
          ? { label: c.emails_sent === 1 ? "Emailed" : `Emailed ${c.emails_sent}x`, cls: "bg-blue-50 text-blue-700" }
          : { label: launched ? "Sending soon" : "Queued", cls: "bg-amber-50 text-amber-700" };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5E0009]">Team Fundraiser</p>
        <h2 className="text-xl font-extrabold uppercase text-gray-900 leading-tight">{campaign.title}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">You've raised</p>
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums">${Number(me.raised).toFixed(0)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Contacts</p>
            <p className="text-2xl font-extrabold text-gray-900 tabular-nums">
              {me.contacts.length}
              <span className="text-sm font-semibold text-gray-400"> / {CONTACT_GOAL}</span>
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div className="h-2 rounded-full bg-[#5E0009] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {launched
            ? "The fundraiser is live. New contacts are emailed within about 10 minutes, with two reminders if they haven't given."
            : launch
              ? `Emails go out ${launch.toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Add your contacts before then.`
              : "The launch date hasn't been set yet. Add your contacts now and they'll be emailed when it launches."}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 space-y-3">
        <h3 className="text-lg font-extrabold uppercase text-gray-900">Your Link</h3>
        <p className="text-xs text-gray-500">Every donation through this link counts toward your total.</p>
        <div className="flex gap-2">
          <input readOnly value={me.shareUrl} className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700" />
          <button
            onClick={() => copy(me.shareUrl, "Link")}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#5E0009] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7a0012] transition"
          >
            <Copy size={14} /> Copy
          </button>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 mb-1">Text it to people</p>
          <p className="text-sm text-gray-700">{textMessage}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => copy(textMessage, "Message")}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#5E0009]/40 hover:text-[#5E0009] transition"
            >
              <Copy size={13} /> Copy message
            </button>
            <a
              href={`sms:?&body=${encodeURIComponent(textMessage)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#5E0009]/40 hover:text-[#5E0009] transition"
            >
              <MessageSquare size={13} /> Open in Messages
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-6 space-y-3">
        <div>
          <h3 className="text-lg font-extrabold uppercase text-gray-900">Email Contacts</h3>
          <p className="text-xs text-gray-500">
            Family, friends, coaches, old teammates. The site emails each one a personal ask from you. Aim for{" "}
            {CONTACT_GOAL}.
          </p>
        </div>
        <textarea
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={"One per line, for example:\nMom, mom@example.com\nCoach Smith <smith@example.com>"}
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            {me.contacts.length} of {me.maxContacts} max
          </span>
          <button
            onClick={handleAdd}
            disabled={saving || !draft.trim()}
            className="inline-flex items-center justify-center bg-[#5E0009] text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-[#7a0012] transition shadow-sm disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add Contacts"}
          </button>
        </div>

        {me.contacts.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {me.contacts.map((c) => {
              const st = status(c);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    {c.name && <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>}
                    <p className="text-xs text-gray-500 truncate">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    {!c.donated && (
                      <button onClick={() => handleRemove(c)} aria-label={`Remove ${c.email}`} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
