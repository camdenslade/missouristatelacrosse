import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiRequest } from "../../Services/API";

// Landing page for the unsubscribe link in fundraiser outreach emails.
export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");
  const [status, setStatus] = useState<"working" | "done" | "invalid">(token ? "working" : "invalid");

  useEffect(() => {
    if (!token) return;
    apiRequest("/api/unsubscribe", { method: "POST", json: { token } })
      .then(() => setStatus("done"))
      .catch(() => setStatus("invalid"));
  }, [token]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <img src="/missouri-state.png" alt="Mo State" className="h-20 w-20 mx-auto mb-6 object-contain" />
      {status === "working" && <p className="text-gray-500 animate-pulse">Updating your preferences...</p>}
      {status === "done" && (
        <>
          <h1 className="text-3xl font-extrabold uppercase text-gray-900 mb-3">You're Unsubscribed</h1>
          <p className="text-gray-600">You won't get any more fundraiser emails from Missouri State Lacrosse.</p>
        </>
      )}
      {status === "invalid" && (
        <>
          <h1 className="text-3xl font-extrabold uppercase text-gray-900 mb-3">Link Not Recognized</h1>
          <p className="text-gray-600">
            This unsubscribe link isn't valid. Reply to the email or contact missouristatelacrosse@gmail.com and we'll
            remove you.
          </p>
        </>
      )}
    </div>
  );
}
