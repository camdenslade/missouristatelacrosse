import { FaInstagram, FaFacebook } from "react-icons/fa";

import { getProgramInfo } from "../../Services/programHelper.js";

export default function Footer() {
  const { program } = getProgramInfo();

  const isWomen = program === "women";
  const teamName = isWomen
    ? "Missouri State Women’s Lacrosse"
    : "Missouri State Men’s Lacrosse";

  const instagramURL = isWomen
    ? "https://www.instagram.com/mostatewlax/"
    : "https://www.instagram.com/msu.lacrosse/";

  const facebookURL = isWomen
    ? "https://www.facebook.com/Missouri-State-Womens-Lacrosse/"
    : "https://www.facebook.com/MoStateLax/";

  return (
    <footer className="no-print bg-gray-800 text-gray-300 py-6 w-full">
      <div className="flex flex-col items-center gap-3">
        {/* Social icons */}
        <div className="flex gap-6 text-2xl">
          <a
            href={instagramURL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition"
            aria-label="Instagram"
          >
            <FaInstagram />
          </a>

          <a
            href={facebookURL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition"
            aria-label="Facebook"
          >
            <FaFacebook />
          </a>
        </div>

        {/* Copyright */}
        <div className="text-center text-sm">
          © {new Date().getFullYear()} {teamName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
