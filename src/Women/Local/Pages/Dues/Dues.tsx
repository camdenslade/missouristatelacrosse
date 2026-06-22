import { useEffect, useState } from "react";
import { useAuth } from "../../../../Global/Context/AuthContext";
import { apiRequest } from "../../../../Services/API";
import type { ApiPlayer, ApiUser } from "../../../../types/api";

export default function Dues() {
  const { user, roles } = useAuth();
  const isWomenSite = window.location.pathname.toLowerCase().includes("/women");
  const program = isWomenSite ? "women" : "men";
  const role = roles?.[program];

  const [player, setPlayer] = useState<ApiPlayer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const userRecord = await apiRequest<ApiUser>(`/api/users/${user.uid}`).catch(() => null);
        if (userRecord?.playerId) {
          const p = await apiRequest<ApiPlayer>(`/api/players/${userRecord.playerId}`).catch(() => null);
          setPlayer(p);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const balance = player?.balance != null ? Number(player.balance) : null;

  if (loading) {
    return <p className="text-gray-500 animate-pulse text-center py-12">Loading your dues info…</p>;
  }

  return (
    <div className="max-w-lg mx-auto mt-12 px-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isWomenSite ? "Women's" : "Men's"} Lacrosse Dues
      </h1>

      {role === "admin" && !player && (
        <p className="text-sm text-gray-400 mb-4">Admin view. No player record linked to your account.</p>
      )}

      {player ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <p className="text-gray-700 text-sm mb-1">Player</p>
          <p className="text-xl font-semibold text-gray-900 mb-6">{player.name}</p>

          <p className="text-gray-700 text-sm mb-1">Dues Balance</p>
          <p className={`text-4xl font-bold mb-2 ${balance !== null && balance > 0 ? "text-red-600" : "text-green-600"}`}>
            {balance !== null ? `$${balance.toFixed(2)}` : "—"}
          </p>
          {balance !== null && balance > 0 && (
            <p className="text-sm text-red-500 mt-1">You have an outstanding balance. Please pay via the Payments page.</p>
          )}
          {balance !== null && balance <= 0 && (
            <p className="text-sm text-green-600 mt-1">You're all paid up!</p>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-gray-600 text-sm">No player record is linked to your account yet.</p>
          <p className="text-gray-500 text-xs mt-2">Contact your coach or admin if you believe this is an error.</p>
        </div>
      )}

      <div className="mt-6">
        <a
          href={isWomenSite ? "/women/payments" : "/payments"}
          className="inline-block bg-[#5E0009] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#7a0012] transition"
        >
          Go to Payments
        </a>
      </div>
    </div>
  );
}
