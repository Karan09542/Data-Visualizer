import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Home, ArrowLeft, AlertCircle, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 md:p-10"
        id="not-found-card"
      >
        {/* Animated Icon Container */}
        <motion.div
          initial={{ scale: 0.8, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.1,
          }}
          className="mx-auto w-20 h-20 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400"
        >
          <AlertCircle className="w-10 h-10" />
        </motion.div>

        {/* 404 Heading */}
        <h1 className="text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2 font-mono">
          404
        </h1>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">
          Page Not Found
        </h2>

        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed text-sm">
          Oops! The page you are looking for doesn't exist, has been removed, or is temporarily unavailable. Let's get you back on track.
        </p>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium rounded-xl transition duration-150 ease-in-out shadow-sm shadow-indigo-100 dark:shadow-none"
            id="btn-home"
          >
            <Home className="w-4 h-4" />
            Go to Home
          </Link>
          <Link
            to="/examples"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition duration-150 ease-in-out"
            id="btn-examples"
          >
            <Compass className="w-4 h-4" />
            View Examples
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
