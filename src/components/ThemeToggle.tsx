import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kipu-theme");
      if (saved) return saved === "dark";
      // Default to crisp light theme for maximum initial clarity
      return false;
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("kipu-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("kipu-theme", "light");
    }
  }, [isDark]);

  return (
    <button
      id="theme-toggle"
      onClick={() => setIsDark(!isDark)}
      className="p-2 rounded-[10px] bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors duration-150 flex items-center justify-center text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 cursor-pointer"
      title={isDark ? "Cambiar a Tema Claro" : "Cambiar a Tema Oscuro"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-500 animate-pulse" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700" />
      )}
    </button>
  );
}
