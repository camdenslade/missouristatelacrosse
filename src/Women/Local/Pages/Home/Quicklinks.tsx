import { ArrowUpRight } from "lucide-react";

const links = [
  { href: "/women/roster", title: "Roster", desc: "Meet the players who make up the Bears." },
  { href: "/women/schedule", title: "Schedule", desc: "Upcoming games, results, and locations." },
  { href: "/women/store", title: "Team Store", desc: "Shop official Women's Lacrosse merchandise." },
  {
    href: "https://www.wcla.club/page/show/9214843-missouri-state",
    title: "WCLA Page",
    desc: "The Bears' official WCLA team page.",
    external: true,
  },
];

export default function Quicklinks() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-baseline justify-between mb-10 md:mb-14 gap-6">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold uppercase text-gray-900">
            Quick Links
          </h2>
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="border-t border-gray-200">
          {links.map(({ href, title, desc, external }, i) => (
            <a
              key={href}
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex items-center gap-8 py-8 md:py-10 border-b border-gray-200 hover:bg-[#5E0009]/5 transition-colors px-3 -mx-3"
            >
              <span className="text-base md:text-lg font-semibold text-gray-300 group-hover:text-[#5E0009]/50 transition-colors tabular-nums">
                0{i + 1}
              </span>
              <span className="text-2xl md:text-4xl lg:text-5xl font-bold uppercase text-gray-900 group-hover:text-[#5E0009] transition-colors">
                {title}
              </span>
              <span className="hidden md:block text-base text-gray-500 flex-1 truncate">{desc}</span>
              <ArrowUpRight
                size={28}
                className="ml-auto shrink-0 text-gray-300 group-hover:text-[#5E0009] group-hover:translate-x-1 group-hover:-translate-y-1 transition-all"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
