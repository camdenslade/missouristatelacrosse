export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-linear-to-r from-[#5E0009] via-[#7a1020] to-[#5E0009] text-white px-6 py-14 text-center">
        <div className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-3">
          <span className="h-px w-6 bg-white/40" />
          Legal
          <span className="h-px w-6 bg-white/40" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold">Terms of Service</h1>
        <p className="text-white/80 mt-2">Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14 text-gray-700 leading-relaxed space-y-8">
        <p>
          These terms cover your use of the Missouri State Lacrosse website, our men's and
          women's club lacrosse programs' online home for rosters, schedules, events, the team
          store, and donations. By using this site, you agree to these terms.
        </p>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Accounts</h2>
          <p>Some areas of the site (settings, payments, roster management) require an account. You're responsible for keeping your login credentials secure and for the accuracy of information you submit.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Payments, Donations &amp; Orders</h2>
          <p>Donations, dues, event registrations, and store purchases are processed through PayPal (and, where enabled, Stripe). All charges are subject to the payment processor's own terms. Donations and completed purchases are generally final; contact an officer if something went wrong with your order or payment.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acceptable Use</h2>
          <p>Don't use this site to submit false information, interfere with its operation, or access areas or data you're not authorized to see. Accounts found abusing the site may be suspended.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Content</h2>
          <p>Team photos, articles, and other content on this site belong to Missouri State Lacrosse or their original owners and are shared for informational purposes. Don't reuse them without permission.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Warranty</h2>
          <p>This site is run by a student club, on a best-effort basis. We don't guarantee it will always be available or error-free, and we're not liable for issues arising from its use beyond what applicable law requires.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Changes</h2>
          <p>We may update these terms as the site evolves. Continued use of the site after a change means you accept the updated terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Contact</h2>
          <p>Questions about these terms? Reach out through our <a href="/sponsorships" className="text-[#5E0009] font-semibold hover:underline">contact options</a> or an officer of the organization.</p>
        </section>

        <p className="text-sm text-gray-400">
          This document is provided for transparency and is not a substitute for legal advice.
        </p>
      </div>
    </div>
  );
}
