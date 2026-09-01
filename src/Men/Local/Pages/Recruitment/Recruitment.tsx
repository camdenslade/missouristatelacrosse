import { ArrowRight } from "lucide-react";
import { useReducer } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

import {
  validateEmail,
  validatePhone,
  validateText,
} from "../../../../Global/Common/utils/validation";
import { apiRequest } from "../../../../Services/API";

const initialState = {
  formData: {
    name: "",
    email: "",
    phone: "",
    classYear: "",
    position: "",
    hometown: "",
    highSchool: "",
    state: "",
    instagram: "",
  },
  submitting: false,
  error: "",
};

function reducer(state, action){
  switch (action.type){
    case "UPDATE_FIELD":
      return {
        ...state,
        formData: { ...state.formData, [action.name]: action.value },
      };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET_FORM":
      return initialState;
    default:
      return state;
  }
}

export default function RecruitmentForm({ userRole }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const normalizeText = (value) => value.replace(/\s+/g, " ").replace(/^\s+/, "");

  const formatInstagram = (value) => {
    const trimmed = value.trim().replace(/\s+/g, "");
    if (!trimmed) return "";
    return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  };

  const formatState = (value) =>
    value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formatted = value;
    if (name === "phone") formatted = formatPhone(value);
    if (name === "email") formatted = value.trim().toLowerCase();
    if (name === "state") formatted = formatState(value);
    if (name === "instagram") formatted = formatInstagram(value);
    if (
      name === "name" ||
      name === "classYear" ||
      name === "position" ||
      name === "hometown" ||
      name === "highSchool"
    ) {
      formatted = normalizeText(value);
    }
    dispatch({ type: "UPDATE_FIELD", name, value: formatted });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError =
      validateText(state.formData.name, "Name", { required: true, max: 80 }) ||
      validateEmail(state.formData.email) ||
      validatePhone(state.formData.phone, { required: true }) ||
      validateText(state.formData.classYear, "Class year", { required: true, max: 20 }) ||
      validateText(state.formData.position, "Position", { required: true, max: 40 }) ||
      validateText(state.formData.hometown, "Hometown", { required: true, max: 80 }) ||
      validateText(state.formData.highSchool, "High school", { required: true, max: 80 }) ||
      validateText(state.formData.state, "State", { required: true, max: 30 }) ||
      validateText(state.formData.instagram, "Instagram", { required: false, max: 60 });
    if (validationError) {
      dispatch({ type: "SET_ERROR", payload: validationError });
      return;
    }
    dispatch({ type: "SET_SUBMITTING", payload: true });
    try{
      await apiRequest("/api/recruitment", {
        method: "POST",
        json: state.formData,
      });

      toast.success("Submission successful! Saved to recruitment");
      dispatch({ type: "RESET_FORM" });
    } catch (err){
      console.error(err);
      toast.error("Failed to submit. Please try again.");
      dispatch({ type: "SET_SUBMITTING", payload: false });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Join the Team
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Recruitment Form</h1>
        <p className="text-white/80 mt-3 max-w-lg mx-auto">
          Interested in playing for Missouri State Lacrosse? Tell us about yourself and
          we'll be in touch.
        </p>

        {(userRole === "admin" || userRole === "player") && (
          <Link
            to="/recruitment/submissions"
            className="inline-flex items-center gap-1.5 mt-6 bg-white text-[#5E0009] px-5 py-2.5 rounded-full font-semibold hover:bg-gray-200 transition"
          >
            View Submissions
            <ArrowRight size={16} strokeWidth={3} />
          </Link>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-16">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg p-6 md:p-8 flex flex-col gap-4"
        >
          {[
            { name: "name", placeholder: "Full Name", type: "text" },
            { name: "email", placeholder: "Email", type: "email" },
            { name: "phone", placeholder: "Phone Number", type: "text" },
            { name: "classYear", placeholder: "Class Year", type: "text" },
            { name: "position", placeholder: "Position", type: "text" },
            { name: "hometown", placeholder: "Hometown", type: "text" },
            { name: "highSchool", placeholder: "High School", type: "text" },
            { name: "state", placeholder: "State", type: "text" },
            { name: "instagram", placeholder: "Instagram Handle (optional)", type: "text" },
          ].map((field) => (
            <input
              key={field.name}
              type={field.type}
              name={field.name}
              placeholder={field.placeholder}
              value={state.formData[field.name]}
              onChange={handleChange}
              required={field.name !== "instagram"}
              className="p-3 border border-gray-200 rounded-xl shadow-sm text-base focus:outline-none focus:ring-2 focus:ring-[#5E0009]/30 focus:border-[#5E0009] transition w-full"
            />
          ))}

          {state.error && (
            <p className="text-red-600 text-sm font-medium">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={state.submitting}
            className="px-6 py-3 bg-[#5E0009] text-white font-semibold rounded-full hover:bg-[#7a0012] transition w-full sm:w-auto mt-2 disabled:opacity-60"
          >
            {state.submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}

