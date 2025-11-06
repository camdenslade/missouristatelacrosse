// src/Global/Authentication/PendingApproval.jsx
import { Link } from "react-router-dom";

import { getActiveProgram } from "../../Services/programHelper.js";

export default function PendingApproval() {
  const program = getActiveProgram();

  const programName =
    program === "women"
      ? "Missouri State Women's Lacrosse"
      : "Missouri State Men's Lacrosse";

  const homeLink = program === "women" ? "/women" : "/";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8 text-center">
        <h1 className="text-2xl font-bold text-[#5E0009] mb-4">
          Account Pending Approval
        </h1>

        <p className="text-gray-700 mb-6">
          Your account request for{" "}
          <span className="font-semibold">{programName}</span> has been
          submitted and is currently awaiting review by an administrator. You’ll
          receive access once approved.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            to={homeLink}
            className="bg-[#5E0009] text-white px-4 py-2 rounded-lg hover:bg-[#7a0012] transition"
          >
            Return to Home
          </Link>
          <p className="text-sm text-gray-500">
            If this is taking longer than expected, please contact your team
            administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
