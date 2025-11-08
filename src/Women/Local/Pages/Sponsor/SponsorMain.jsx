// src/Women/Local/Pages/Sponsor/SponsorMain.jsx
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

export default function WSponsorMain() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    contactInfo: "",
    request: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/sponsor-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      alert("Thank you! Your sponsorship inquiry has been submitted.");
      setForm({ businessName: "", contactInfo: "", request: "" });
      setOpen(false);
    } catch (err) {
      console.error("Error submitting sponsor request:", err);
      alert("There was an issue submitting your request. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-gray-800">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold text-[#5E0009] mb-4"
      >
        Missouri State University Women’s Lacrosse
      </motion.h1>

      <h3 className="text-xl font-bold text-black mb-4">
        Sponsorship Opportunities
      </h3>

      <p className="mb-4">
        Coming Soon..
      </p>

      <div className="border-t pt-4 mb-6">
        <p className="font-semibold">Grace Esker</p>
        <p>President, Missouri State Women’s Lacrosse</p>
        <p>
          <a
            href="mailto:mostatewomenslax@gmail.com"
            className="text-[#5E0009] hover:underline font-medium"
          >
            mostatewomenslax@gmail.com
          </a>
        </p>
      </div>

      {/* Contact Us Button */}
      <div className="text-center">
        <button
          onClick={() => setOpen(true)}
          className="bg-[#5E0009] text-white px-8 py-3 rounded-md font-semibold hover:bg-red-800 transition"
        >
          Contact Us
        </button>
      </div>

      {/* Modal Form */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl w-[90%] max-w-md p-6 relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-4 text-gray-500 hover:text-gray-800 text-2xl"
              >
                &times;
              </button>

              <h3 className="text-2xl font-semibold text-[#5E0009] mb-4 text-center">
                Sponsor Inquiry Form
              </h3>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={form.businessName}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Information
                  </label>
                  <input
                    type="text"
                    name="contactInfo"
                    value={form.contactInfo}
                    onChange={handleChange}
                    placeholder="Email or phone"
                    required
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Short Request or Message
                  </label>
                  <textarea
                    name="request"
                    value={form.request}
                    onChange={handleChange}
                    rows="3"
                    required
                    className="w-full border border-gray-300 rounded-md p-2 resize-none focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#5E0009] text-white font-semibold py-2 rounded-md hover:bg-red-800 transition disabled:opacity-70"
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
