import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import API_BASE from "../../../../Services/API.js";

export default function SponsorForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    email: "",
    phone: "",
    request: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email && !form.phone) {
      alert("Please provide at least an email or phone number.");
      return;
    }

    setLoading(true);

    try {
      // 1️⃣ Always email bcole
      await fetch(`${API_BASE}/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "17bcole@gmail.com",
          subject: `New Sponsorship Inquiry – ${form.businessName}`,
          body: `Business Name: ${form.businessName}\nEmail: ${
            form.email || "N/A"
          }\nPhone: ${form.phone || "N/A"}\n\nMessage:\n${form.request}`,
        }),
      });

      // 2️⃣ Email sponsor (only if they provided an email)
      if (form.email) {
        await fetch(`${API_BASE}/email/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: form.email,
            subject: "Thank You for Reaching Out – Missouri State Lacrosse",
            body: `Hi ${form.businessName},\n\nThank you for your interest in partnering with Missouri State Lacrosse!\n\nWe’ve received your inquiry and will reach out soon to discuss sponsorship opportunities.\n\nGo Bears!\n\n— Missouri State Lacrosse`,
          }),
        });
      }

      alert("Thank you for your interest! Your message has been sent.");
      setForm({ businessName: "", email: "", phone: "", request: "" });
      setOpen(false);
    } catch (err) {
      console.error("Sponsor email error:", err);
      alert("There was an issue sending your message. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white py-20 text-center px-6 relative">
      <h2 className="text-3xl md:text-4xl font-bold text-[#5E0009] mb-4">
        Work With Us
      </h2>
      <p className="max-w-2xl mx-auto text-gray-700 mb-8 text-lg">
        Partner with Missouri State Lacrosse through sponsorships and community
        collaborations. Your business can help support student-athletes,
        enhance facilities, and grow the game we love.
        <br />
        <button
          onClick={() => setOpen(true)}
          className="text-[#5E0009] font-semibold underline hover:text-red-800 transition"
        >
          Contact us for more details
        </button>
        .
      </p>

      <a
        href="/work-with-us"
        className="inline-block bg-[#5E0009] text-white px-8 py-3 rounded-md font-semibold hover:bg-red-800 transition"
      >
        Become a Sponsor
      </a>

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

              <h3 className="text-2xl font-semibold text-[#5E0009] mb-4">
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
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Optional if phone provided"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Optional if email provided"
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#5E0009] focus:border-[#5E0009] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message or Request
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
                  {loading ? "Sending..." : "Submit"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
