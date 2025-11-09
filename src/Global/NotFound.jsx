// src/Global/NotFound.jsx
import { motion } from "framer-motion";
import { Helmet } from "react-helmet";
import { Link, useLocation } from "react-router-dom";
import routes from "./routesList";

export default function NotFound() {
  const location = useLocation();
  const knownRoutes = routes.map((r) => r.path);

  const isKnown = knownRoutes.some((path) => {
    const pattern = "^" + path.replace(/:\w+/g, "[^/]+") + "$";
    const regex = new RegExp(pattern);
    return regex.test(location.pathname);
  });

  return (
    <>
      {!isKnown && (
        <Helmet>
          <meta name="robots" content="noindex" />
          <title>404 Not Found | Missouri State Lacrosse</title>
        </Helmet>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6"
      >
        <h1 className="text-6xl font-extrabold text-[#5E0009] mb-4">404</h1>
        <p className="text-gray-700 text-lg mb-6">
          Oops! The page you’re looking for doesn’t exist or has been moved.
        </p>
        <Link
          to="/"
          className="bg-[#5E0009] text-white px-6 py-3 rounded-md font-semibold hover:bg-red-800 transition"
        >
          Return Home
        </Link>
      </motion.div>
    </>
  );
}
