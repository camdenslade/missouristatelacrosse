import { useReducer } from "react";
import toast from "react-hot-toast";

import { apiRequest } from "../Services/API";
import { validateEmail, validateText } from "./Common/utils/validation";

const initialState = {
  form: { name: "", email: "", subject: "", message: "" },
  submitting: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, form: { ...state.form, [action.field]: action.value } };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export default function Support() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError =
      validateText(state.form.name, "Name", { required: true, max: 80 }) ||
      validateEmail(state.form.email) ||
      validateText(state.form.message, "Message", { required: true, max: 2000 });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    dispatch({ type: "SET_SUBMITTING", payload: true });
    try {
      await apiRequest("/api/contact", { method: "POST", json: state.form });
      toast.success("Message sent - we'll get back to you soon.");
      dispatch({ type: "RESET" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to send. Please email us directly at support@missouristatelacrosse.com.");
    } finally {
      dispatch({ type: "SET_SUBMITTING", payload: false });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Support
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Contact Us</h1>
        <p className="text-white/80 mt-3 max-w-lg mx-auto">
          Questions about dues, events, the team store, or anything else? Send us a message
          and we'll get back to you.
        </p>
      </div>

      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-16">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg p-6 md:p-8 flex flex-col gap-4"
        >
          <input
            type="text"
            placeholder="Full Name"
            value={state.form.name}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })}
            required
            className="p-3 border border-gray-200 rounded-xl shadow-sm text-base focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition w-full"
          />
          <input
            type="email"
            placeholder="Email"
            value={state.form.email}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "email", value: e.target.value })}
            required
            className="p-3 border border-gray-200 rounded-xl shadow-sm text-base focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition w-full"
          />
          <input
            type="text"
            placeholder="Subject (optional)"
            value={state.form.subject}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "subject", value: e.target.value })}
            className="p-3 border border-gray-200 rounded-xl shadow-sm text-base focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition w-full"
          />
          <textarea
            placeholder="How can we help?"
            value={state.form.message}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "message", value: e.target.value })}
            required
            rows={6}
            className="p-3 border border-gray-200 rounded-xl shadow-sm text-base focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition w-full"
          />
          <button
            type="submit"
            disabled={state.submitting}
            className="px-6 py-3 bg-[#5E0009] text-white font-semibold rounded-full hover:bg-[#7a0012] transition w-full sm:w-auto mt-2 disabled:opacity-60"
          >
            {state.submitting ? "Sending..." : "Send Message"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Or email us directly at{" "}
            <a href="mailto:support@missouristatelacrosse.com" className="text-[#5E0009] hover:underline">
              support@missouristatelacrosse.com
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
