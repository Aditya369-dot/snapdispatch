export type PilotErrorBody = { error?: { code?: string; message?: string } };

export async function pilotFetch<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T & PilotErrorBody }> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const text = await response.text();
  const body = (text ? JSON.parse(text) : {}) as T & PilotErrorBody;
  return { status: response.status, body };
}

export type Me = {
  profileId: string;
  organizationId: string;
  role: "owner" | "driver" | "dispatcher";
  driverId: string | null;
  displayName: string;
  displayTimezone: string;
};
