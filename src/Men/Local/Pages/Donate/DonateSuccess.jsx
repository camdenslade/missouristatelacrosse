// src/pages/donate/DonateSuccess.jsx
import { useLocation, useNavigate } from "react-router-dom";

export default function DonateSuccess() {
  const location = useLocation();
  const navigate = useNavigate();

  const order = location.state?.order;
  const amount = location.state?.amount;

  if (!order) {
    navigate("/donate");
    return null;
  }

  const payer = order.payer || {};
  const name = `${payer.name?.given_name || ""} ${payer.name?.surname || ""}`.trim();
  const email = payer.email_address || "N/A";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-[#5E0009] mb-4">Thank You!</h1>
        <p className="text-gray-700 mb-4">
          Your generous donation of{" "}
          <span className="font-semibold">${amount?.toFixed(2)}</span> has been received.
        </p>
        <div className="bg-gray-100 rounded-lg p-4 text-left mb-6">
          <p><strong>Donor Name:</strong> {name}</p>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Transaction ID:</strong> {order.id}</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 bg-[#5E0009] text-white rounded-lg hover:bg-[#7a0012] transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
