const ALLOWED_COLLECTIONS = new Set(["todos", "tickets", "bills", "travelers"]);
const TRIP_ID_PATTERN = /^[a-z0-9-]{3,80}$/i;
const MAX_CHANGES = 100;
const MAX_PAYLOAD_LENGTH = 65536;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function allowedCollections(request) {
  const requested = String(new URL(request.url).searchParams.get("collections") || "")
    .split(",")
    .map((collection) => collection.trim())
    .filter(Boolean);
  const unique = [...new Set(requested)];
  if (!unique.length || unique.some((collection) => !ALLOWED_COLLECTIONS.has(collection))) return null;
  return unique;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hashesMatch(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function authorize(request, env, tripId) {
  const accessCode = String(request.headers.get("x-travel-access-code") || "").trim();
  if (!accessCode || !env.TRIP_DB) return false;
  const access = await env.TRIP_DB.prepare("SELECT code_hash FROM trip_access WHERE trip_id = ?1")
    .bind(tripId)
    .first();
  return hashesMatch(access?.code_hash, await sha256(accessCode));
}

async function snapshot(env, tripId, collections) {
  const records = await env.TRIP_DB.prepare(
    "SELECT collection, payload FROM trip_records WHERE trip_id = ?1 AND collection IN (" + collections.map((_, index) => `?${index + 2}`).join(",") + ") ORDER BY updated_at, record_id"
  ).bind(tripId, ...collections).all();
  const result = { version: 1, updatedAt: new Date().toISOString() };
  collections.forEach((collection) => { result[collection] = []; });
  (records.results || []).forEach((record) => {
    try { result[record.collection].push(JSON.parse(record.payload)); } catch { /* Invalid stored data is ignored rather than exposed. */ }
  });
  return result;
}

function validateChanges(changes, collections) {
  if (!Array.isArray(changes) || changes.length > MAX_CHANGES) return null;
  const allowed = new Set(collections);
  for (const change of changes) {
    if (!change || typeof change !== "object" || !allowed.has(change.collection)) return null;
    if ((change.op !== "upsert" && change.op !== "delete") || !String(change.id || "").trim() || String(change.id).length > 160) return null;
    if (change.op === "upsert" && (change.value === undefined || JSON.stringify(change.value).length > MAX_PAYLOAD_LENGTH)) return null;
  }
  return changes;
}

async function applyChanges(env, tripId, changes) {
  const updatedAt = new Date().toISOString();
  const statements = changes.map((change) => change.op === "delete"
    ? env.TRIP_DB.prepare("DELETE FROM trip_records WHERE trip_id = ?1 AND collection = ?2 AND record_id = ?3")
      .bind(tripId, change.collection, String(change.id))
    : env.TRIP_DB.prepare(
      "INSERT INTO trip_records (trip_id, collection, record_id, payload, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(trip_id, collection, record_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at"
    ).bind(tripId, change.collection, String(change.id), JSON.stringify(change.value), updatedAt));
  if (statements.length) await env.TRIP_DB.batch(statements);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const tripId = String(params.tripId || "");
  if (!TRIP_ID_PATTERN.test(tripId)) return json({ error: "Invalid trip" }, 400);
  const collections = allowedCollections(request);
  if (!collections) return json({ error: "Invalid collections" }, 400);
  if (!(await authorize(request, env, tripId))) return json({ error: "邀请码无效" }, 401);
  if (request.method === "GET") return json(await snapshot(env, tripId, collections));
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const changes = validateChanges(payload?.changes, collections);
  if (!changes) return json({ error: "Invalid changes" }, 400);
  await applyChanges(env, tripId, changes);
  return json(await snapshot(env, tripId, collections));
}
