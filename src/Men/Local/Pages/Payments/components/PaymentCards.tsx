import { CheckCircle2, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { fetchPaymentCards, fetchPlayerCardStatuses, setPlayerCardStatus } from "../hooks/usePaymentCards";
import type { ApiPaymentCard, ApiPaymentCardStatus } from "../../../../../types/api";

type PaymentCardsProps = {
  playerId: string;
  season: string;
};

export default function PaymentCards({ playerId, season }: PaymentCardsProps) {
  const [cards, setCards] = useState<ApiPaymentCard[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ApiPaymentCardStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId || !season) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPaymentCards(season), fetchPlayerCardStatuses(playerId)])
      .then(([cardList, statusList]) => {
        if (cancelled) return;
        setCards(cardList.filter((c) => c.active));
        setStatuses(
          statusList.reduce<Record<string, ApiPaymentCardStatus>>((acc, s) => {
            acc[s.cardId] = s;
            return acc;
          }, {})
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCards([]);
          setStatuses({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, season]);

  if (loading || cards.length === 0) return null;

  const handleToggle = async (card: ApiPaymentCard, done: boolean) => {
    setSaving(card.id);
    try {
      const updated = await setPlayerCardStatus(card.id, playerId, done);
      setStatuses((prev) => ({ ...prev, [card.id]: updated }));
      if (done) toast.success(`${card.title} marked as done!`);
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h3 className="font-medium text-sm mb-2 text-gray-800">To Do</h3>
      <div className="space-y-3">
        {cards.map((card) => {
          const done = statuses[card.id]?.done ?? false;
          return (
            <div
              key={card.id}
              className={`bg-white border rounded-2xl shadow-sm p-4 transition ${
                done ? "border-green-200" : "border-gray-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-gray-900">{card.title}</h4>
                  {card.description && (
                    <p className="text-sm text-gray-600 mt-1">{card.description}</p>
                  )}
                  {card.amount != null && (
                    <p className="text-sm font-semibold text-[#5E0009] mt-1">${Number(card.amount).toFixed(2)}</p>
                  )}
                  {card.link && (
                    <a
                      href={card.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-[#5E0009] font-semibold mt-2 hover:underline"
                    >
                      Go to site <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(card, !done)}
                  disabled={saving === card.id}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                    done
                      ? "bg-green-50 text-green-700 hover:bg-green-100"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  } disabled:opacity-50`}
                >
                  <CheckCircle2 size={15} />
                  {done ? "Done" : "Mark as Done"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
