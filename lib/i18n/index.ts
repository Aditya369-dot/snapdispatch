"use client";

import { copy, type Lang } from "@/lib/i18n/copy";
import { localize } from "@/lib/i18n/say";
import { setActiveLocale } from "@/lib/format";
import { useDemo } from "@/lib/store";
import { useEffect } from "react";

export function useI18n() {
  const lang = useDemo((state) => state.language);
  const setLanguage = useDemo((state) => state.setLanguage);
  const safe: Lang = lang === "es" ? "es" : "en";
  setActiveLocale(safe === "es" ? "es-MX" : "en-US");
  useEffect(() => {
    document.documentElement.lang = safe === "es" ? "es" : "en";
  }, [safe]);
  return {
    lang: safe,
    setLanguage,
    c: copy[safe],
    text: (value?: string) => localize(safe, value ?? ""),
  };
}
