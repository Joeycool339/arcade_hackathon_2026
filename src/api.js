// Every request goes to one Videoselz endpoint. Videoselz holds the Arcade
// key and calls the Arcade API; this site never sees a key.
const ENDPOINT =
  import.meta.env.VITE_VIDEOSELZ_URL || "https://videoselz--development.gadget.app/arcade-public/studio";

export const CONTACT = "yash@videoselz.com";

// The Arcade API procedure behind each step, shown in the "Behind the scenes" log.
export const ARCADE_CALL = {
  categories: "categories/list",
  category: "categories/get",
  createPattern: "patterns/create",
  refinePattern: "patterns/refine/edit",
  job: "jobs/get",
  createProduct: "products/create",
  product: "products/get",
  publish: "products/get → Videoselz",
  videos: "Videoselz videos",
};

const listeners = new Set();
export const onCall = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * Runs one step. Sent as text/plain so the browser makes a simple request
 * (no CORS preflight). Throws an Error with a readable message on failure.
 */
export async function studio(op, input = {}, code) {
  const started = performance.now();
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ op, input, code }),
    });
  } catch {
    throw new Error(`Can't reach Videoselz right now. Reload in a few seconds, or email ${CONTACT} if it keeps happening.`);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Not JSON: a platform error page.
  }
  const entry = { op, call: ARCADE_CALL[op] ?? op, status: res.status, ms: Math.round(performance.now() - started), at: new Date() };
  if (op !== "job" && op !== "videos") listeners.forEach((fn) => fn(entry));
  if (!res.ok || !body?.success) {
    throw new Error(body?.error ?? `Videoselz answered ${res.status}. Email ${CONTACT} if this keeps happening.`);
  }
  return body;
}
