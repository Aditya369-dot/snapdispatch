"use client";

import { getFile } from "@/lib/files";
import { sampleDataUrl } from "@/lib/samples";
import type { DocumentRecord } from "@/lib/types";
import { useEffect, useState } from "react";

export function DocumentPreview({ doc }: { doc: DocumentRecord }) {
  if (doc.sampleKey) {
    return <PreviewFrame doc={doc} url={sampleDataUrl(doc.sampleKey, doc.sampleParams ?? {})} />;
  }
  return <StoredPreview doc={doc} />;
}

function StoredPreview({ doc }: { doc: DocumentRecord }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(!doc.blobId);

  useEffect(() => {
    if (!doc.blobId) return;
    let revoke = "";
    let cancelled = false;
    getFile(doc.blobId)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        revoke = URL.createObjectURL(blob);
        setUrl(revoke);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [doc.blobId]);

  if (missing) return <p className="text-sm text-[#5c6b80]">Preview isn’t available for this file.</p>;
  if (!url) return <p className="text-sm text-[#5c6b80]">Loading preview…</p>;
  return <PreviewFrame doc={doc} url={url} />;
}

function PreviewFrame({ doc, url }: { doc: DocumentRecord; url: string }) {
  if (doc.mimeType === "application/pdf") {
    return <iframe title={doc.fileName} src={url} className="h-80 w-full rounded-md border bg-white" />;
  }
  return (
    // Blob and sample SVG previews are local demo files, not remote images.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={doc.fileName} className="max-h-96 w-full rounded-md border bg-white object-contain" />
  );
}
