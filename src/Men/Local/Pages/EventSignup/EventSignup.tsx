import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchEvents } from "../../../../Global/Common/hooks/useEvents";
import { getProgramInfo } from "../../../../Services/programHelper";
import type { ApiEvent } from "../../../../types/api";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function EventSignup() {
  const { base } = getProgramInfo();
  const navigate = useNavigate();
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEvents()
      .then(setEvents)
      .catch(() => setError("Failed to load events."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-pulse text-gray-500">Loading events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center text-red-600">{error}</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-[#5E0009] mb-2">Event Signup</h1>
      <p className="text-gray-500 mb-8">Browse upcoming events and register below.</p>

      {events.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-lg">
          No events are currently available.
        </div>
      ) : (
        <div className="grid gap-5">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onRegister={() => navigate(`${base}/event-signup/${event.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  onRegister,
}: {
  event: ApiEvent;
  onRegister: () => void;
}) {
  const isFree = !event.price || event.price <= 0;
  const isTeamEvent = event.teamSize > 1;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      {event.image && (
        <img
          src={event.image}
          alt={event.name}
          className="w-full sm:w-36 object-contain bg-gray-50 rounded-md shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 className="text-xl font-bold text-gray-900">{event.name}</h2>
          {isTeamEvent && (
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
              {event.teamSize}-Person Team
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-gray-500 text-sm mb-2 line-clamp-2">{event.description}</p>
        )}

        <div className="flex flex-col gap-1 text-sm text-gray-600">
          <div>
            <span className="font-medium">Start:</span>{" "}
            {formatDateTime(event.startTime)}
          </div>
          {event.endTime && (
            <div>
              <span className="font-medium">End:</span>{" "}
              {formatDateTime(event.endTime)}
            </div>
          )}
          {event.address && (
            <div>
              <span className="font-medium">Location:</span>{" "}
              {event.mapsLink ? (
                <a
                  href={event.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 underline hover:text-gray-800 transition-colors"
                >
                  {event.address}
                </a>
              ) : (
                event.address
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-3 shrink-0">
        <div className="text-right">
          <div className="text-2xl font-bold text-[#5E0009]">
            {isFree ? "Free" : `$${Number(event.price).toFixed(2)}`}
          </div>
          {isTeamEvent && (
            <div className="text-xs text-gray-400">per person</div>
          )}
        </div>
        <button
          onClick={onRegister}
          className="px-5 py-2 bg-[#5E0009] text-white rounded-lg font-semibold hover:bg-[#7a0010] transition-colors text-sm"
        >
          Register
        </button>
      </div>
    </div>
  );
}
