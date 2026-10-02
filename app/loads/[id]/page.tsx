"use client";

import { LoadDetail } from "@/components/load-detail";
import { useI18n } from "@/lib/i18n";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoadFallback() {
  const { c } = useI18n();
  return <p className="text-sm">{c.loadingLoad}</p>;
}

export default function LoadPage() {
  return (
    <Suspense fallback={<LoadFallback />}>
      <LoadRoute />
    </Suspense>
  );
}

function LoadRoute() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  return <LoadDetail id={params.id} initialTab={search.get("tab") ?? "overview"} />;
}
