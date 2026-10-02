"use client";

import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n/copy";
import { cn } from "cn";

export function LanguageSwitch({ compact = false, tone = "light" }: { compact?: boolean; tone?: "light" | "dark" }) {
  const { lang, setLanguage, c } = useI18n();
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={c.language}>
      {compact ? null : <span className={cn("text-[11px] font-medium", tone === "dark" ? "text-[#c5d4e8]" : "text-[#5c6b80]")}>{c.language}</span>}
      <div className={cn("flex rounded-lg p-0.5", tone === "dark" ? "bg-white/10" : "bg-[#eef2f6]")}>
        <LangButton active={lang === "en"} tone={tone} onClick={() => setLanguage("en" satisfies Lang)}>
          EN
        </LangButton>
        <LangButton active={lang === "es"} tone={tone} onClick={() => setLanguage("es")}>
          ES
        </LangButton>
      </div>
    </div>
  );
}

function LangButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "light" | "dark";
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold",
        active
          ? tone === "dark"
            ? "bg-white text-[#0c2340]"
            : "bg-white shadow-sm"
          : tone === "dark"
            ? "text-[#c5d4e8]"
            : "text-[#5c6b80]",
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
