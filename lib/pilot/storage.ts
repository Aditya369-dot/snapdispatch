import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PilotError } from "@/lib/pilot/errors";

const PATH_PATTERN = /^org\/[0-9a-f-]{36}\/loads\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;

export type StoredObject = { bytes: Buffer; mime: string };

export interface ObjectStore {
  readonly kind: "local" | "supabase";
  put(objectPath: string, bytes: Buffer, mime: string): Promise<void>;
  stat(objectPath: string): Promise<{ size: number } | null>;
  get(objectPath: string): Promise<StoredObject | null>;
  clear(): Promise<void>;
}

function assertSafePath(objectPath: string): void {
  if (!PATH_PATTERN.test(objectPath)) {
    throw new PilotError("invalid_document", 422, "The storage path is not a private load object.");
  }
}

export class LocalObjectStore implements ObjectStore {
  readonly kind = "local" as const;

  constructor(private readonly root: string) {}

  private resolve(objectPath: string): string {
    assertSafePath(objectPath);
    const full = path.resolve(this.root, objectPath);
    const root = path.resolve(this.root);
    if (!full.startsWith(`${root}${path.sep}`)) {
      throw new PilotError("invalid_document");
    }
    return full;
  }

  async put(objectPath: string, bytes: Buffer, mime: string): Promise<void> {
    const full = this.resolve(objectPath);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, bytes);
    await writeFile(`${full}.mime`, mime, "utf8");
  }

  async stat(objectPath: string): Promise<{ size: number } | null> {
    try {
      const info = await stat(this.resolve(objectPath));
      return { size: info.size };
    } catch {
      return null;
    }
  }

  async get(objectPath: string): Promise<StoredObject | null> {
    try {
      const full = this.resolve(objectPath);
      const bytes = await readFile(full);
      const mime = await readFile(`${full}.mime`, "utf8").catch(() => "application/octet-stream");
      return { bytes, mime };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await rm(this.root, { recursive: true, force: true });
    await mkdir(this.root, { recursive: true });
  }
}

/**
 * Private Supabase Storage bucket. Used only when the service-role key is set.
 * The key stays on the server. There is no public object URL.
 */
export class SupabaseObjectStore implements ObjectStore {
  readonly kind = "supabase" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly serviceKey: string,
    private readonly bucket: string,
  ) {}

  private objectUrl(objectPath: string): string {
    assertSafePath(objectPath);
    const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
    return `${this.baseUrl.replace(/\/$/, "")}/storage/v1/object/${this.bucket}/${encoded}`;
  }

  async put(objectPath: string, bytes: Buffer, mime: string): Promise<void> {
    const response = await fetch(this.objectUrl(objectPath), {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
        "content-type": mime,
        "x-upsert": "true",
      },
      body: new Uint8Array(bytes),
    });
    if (!response.ok) {
      throw new PilotError("upload_missing", 502, "Private storage refused the object.");
    }
  }

  async stat(objectPath: string): Promise<{ size: number } | null> {
    const response = await fetch(this.objectUrl(objectPath), {
      method: "HEAD",
      headers: {
        authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
      },
    });
    if (response.status === 400 || response.status === 404) return null;
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length"));
    return Number.isFinite(length) ? { size: length } : { size: -1 };
  }

  async get(objectPath: string): Promise<StoredObject | null> {
    const response = await fetch(this.objectUrl(objectPath), {
      headers: {
        authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
      },
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return { bytes, mime: response.headers.get("content-type") ?? "application/octet-stream" };
  }

  async clear(): Promise<void> {
    throw new PilotError("staging_refused", 403, "Refusing to wipe a Supabase bucket from the local reset command. Use a local storage dir for fixture reset.");
  }
}

let store: ObjectStore | null = null;

export function objectStore(): ObjectStore {
  if (store) return store;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    store = new SupabaseObjectStore(supabaseUrl, serviceKey, process.env.SUPABASE_STORAGE_BUCKET || "load-files");
    return store;
  }
  store = new LocalObjectStore(process.env.PILOT_STORAGE_DIR || ".pilot-storage");
  return store;
}

export function resetObjectStoreForTests(): void {
  store = null;
}

export const SAMPLE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
export const SAMPLE_PDF = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "utf8");
