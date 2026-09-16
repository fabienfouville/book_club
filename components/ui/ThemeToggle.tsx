"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons";

const KEY = "bookclub-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      // navigation privée : on garde simplement le choix pour la session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}
      className="grid h-11 w-11 place-items-center rounded-full border border-border-strong bg-surface text-ink-soft transition hover:bg-surface-muted"
    >
      {dark ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
    </button>
  );
}

/** Applique le thème avant la peinture pour éviter tout clignotement. */
export const themeScript = `
(function(){try{
  var s=localStorage.getItem("${KEY}");
  var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;
  if(d)document.documentElement.classList.add("dark");
}catch(e){}})();
`;
