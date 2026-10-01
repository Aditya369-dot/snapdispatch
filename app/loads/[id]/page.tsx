"use client";

import { LoadDetail } from "@/components/load-detail";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function LoadPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading load…</p>}>
      <LoadRoute />
    </Suspense>
  );
}

function LoadRoute() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  return <LoadDetail id={params.id} initialTab={search.get("tab") ?? "overview"} />;
}
