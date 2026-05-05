const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data", "dispatch-state.json");
const DAY_MS = 24 * 60 * 60 * 1000;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png"
};

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function seedState() {
  return {
    users: [{ id: uid("usr"), role: "admin", name: "يحيى", username: "yahya", password: "123123", phone: "" }],
    orders: []
  };
}

async function readState() {
  if (useSupabase()) return readSupabaseState();

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.users) && Array.isArray(parsed.orders)) return parsed;
  } catch {
    // Create a clean state on first run.
  }
  const initial = seedState();
  await writeState(initial);
  return initial;
}

async function writeState(state) {
  if (useSupabase()) {
    await writeSupabaseState(state);
    return;
  }

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), "utf8");
}

function useSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.hint || `Supabase request failed: ${response.status}`);
  return data;
}

async function readSupabaseState() {
  const [users, orders] = await Promise.all([
    supabaseRequest("hasinah_users?select=*&order=created_at.asc"),
    supabaseRequest("hasinah_orders?select=*&order=created_at.desc")
  ]);
  if (!users.length) {
    const initial = seedState();
    await writeSupabaseState(initial);
    return initial;
  }
  return {
    users: users.map(fromDbUser),
    orders: orders.map(fromDbOrder)
  };
}

async function writeSupabaseState(state) {
  await supabaseRequest("hasinah_orders?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  await supabaseRequest("hasinah_users?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
  if (state.users.length) {
    await supabaseRequest("hasinah_users", { method: "POST", body: state.users.map(toDbUser), prefer: "return=minimal" });
  }
  if (state.orders.length) {
    await supabaseRequest("hasinah_orders", { method: "POST", body: state.orders.map(toDbOrder), prefer: "return=minimal" });
  }
}

function fromDbUser(row) {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    username: row.username,
    password: row.password,
    phone: row.phone || ""
  };
}

function toDbUser(user) {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    username: user.username,
    password: user.password,
    phone: user.phone || null
  };
}

function fromDbOrder(row) {
  return {
    id: row.id,
    kind: row.kind,
    flowType: row.flow_type,
    number: row.number,
    type: row.type,
    customer: row.customer,
    phone: row.phone,
    area: row.area,
    driverId: row.driver_id || "",
    customAmount: Number(row.custom_amount || 0),
    timerHours: Number(row.timer_hours || 24),
    requestDate: row.request_date || "",
    status: row.status,
    acceptedAt: row.accepted_at || "",
    deadlineAt: row.deadline_at || "",
    completedAt: row.completed_at || "",
    cutRemoved: Boolean(row.cut_removed),
    returnedOrderNumber: row.returned_order_number || "",
    replacementOrderNumber: row.replacement_order_number || "",
    sourceOrderId: row.source_order_id || "",
    delayRequests: row.delay_requests || [],
    appeals: row.appeals || [],
    history: row.history || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toDbOrder(order) {
  return {
    id: order.id,
    kind: order.kind,
    flow_type: order.flowType || "order",
    number: order.number,
    type: order.type,
    customer: order.customer,
    phone: order.phone,
    area: order.area,
    driver_id: order.driverId || null,
    custom_amount: Number(order.customAmount || 0),
    timer_hours: Number(order.timerHours || 24),
    request_date: order.requestDate || null,
    status: order.status,
    accepted_at: order.acceptedAt || null,
    deadline_at: order.deadlineAt || null,
    completed_at: order.completedAt || null,
    cut_removed: Boolean(order.cutRemoved),
    returned_order_number: order.returnedOrderNumber || null,
    replacement_order_number: order.replacementOrderNumber || null,
    source_order_id: order.sourceOrderId || null,
    delay_requests: order.delayRequests || [],
    appeals: order.appeals || [],
    history: order.history || [],
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: order.updatedAt || new Date().toISOString()
  };
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  if (Buffer.isBuffer(body) || typeof body === "string") {
    res.end(body);
    return;
  }
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function publicUser(user) {
  return { id: user.id, role: user.role, name: user.name, username: user.username, phone: user.phone };
}

function publicState(state) {
  markLateOrders(state);
  return { users: state.users.map((user) => ({ ...user })), orders: state.orders };
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function createAccount(state, body) {
  const role = String(body.role || "driver");
  const username = String(body.username || "").trim().toLowerCase();
  if (!["admin", "driver"].includes(role)) throw new Error("Choose admin or driver.");
  if (!body.name || !username || !body.password) throw new Error("Name, username, and password are required.");
  if (state.users.some((user) => user.username.toLowerCase() === username)) throw new Error("That username already exists.");
  state.users.push({
    id: uid(role === "admin" ? "adm" : "drv"),
    role,
    name: String(body.name).trim(),
    phone: String(body.phone || "").trim(),
    username,
    password: String(body.password).trim()
  });
}

function createOrder(state, body) {
  if (!body.number || !body.customer || !body.phone || !body.area) {
    throw new Error("رقم الطلب والاسم ورقم الواتساب والحي مطلوبة.");
  }
  const kind = body.kind === "custom" ? "custom" : "customer";
  const now = new Date();
  const customAmount = Number(body.customAmount || 0);
  const timerHours = Number(body.timerHours || 24);
  if (kind === "custom" && (!customAmount || customAmount <= 0)) throw new Error("المشوار الخاص يحتاج مبلغ محدد.");

  state.orders.unshift({
    id: uid("ord"),
    kind,
    number: String(body.number).trim(),
    type: kind === "custom" ? "Custom delivery" : String(body.type || "Delivery"),
    flowType: kind === "custom" ? "custom" : "order",
    customer: String(body.customer).trim(),
    phone: normalizePhone(body.phone),
    area: String(body.area).trim(),
    driverId: String(body.driverId || "").trim(),
    customAmount: kind === "custom" ? customAmount : 0,
    timerHours: kind === "custom" ? Math.max(1, timerHours || 24) : 24,
    requestDate: body.requestDate ? new Date(body.requestDate).toISOString() : now.toISOString(),
    status: kind === "custom" && body.driverId ? "pending_acceptance" : body.driverId ? "accepted" : "new",
    acceptedAt: kind === "customer" && body.driverId ? now.toISOString() : "",
    deadlineAt: kind === "customer" && body.driverId ? new Date(now.getTime() + DAY_MS).toISOString() : "",
    delayRequests: [],
    appeals: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    history: [{ at: now.toISOString(), action: "created" }]
  });
}

function updateOrderState(state, id, patch) {
  const order = state.orders.find((item) => item.id === id);
  if (!order) throw new Error("لم يتم العثور على الطلب.");
  const now = new Date();

  if (Object.prototype.hasOwnProperty.call(patch, "driverId")) {
    order.driverId = String(patch.driverId || "");
    if (order.kind === "custom" && order.driverId && order.status !== "completed") order.status = "pending_acceptance";
    if (order.kind === "customer" && order.driverId && ["new", "pending_acceptance"].includes(order.status)) acceptOrder(order, now);
    if (!order.driverId && order.status !== "completed") {
      order.status = "new";
      order.acceptedAt = "";
      order.deadlineAt = "";
    }
  }

  if (patch.action === "accept") acceptOrder(order, now);
  if (patch.action === "complete") {
    order.status = isLate(order, now) ? "late" : "completed";
    order.completedAt = now.toISOString();
  }
  if (patch.action === "cancel") order.status = "cancelled";
  if (patch.action === "delay_request") {
    order.delayRequests = Array.isArray(order.delayRequests) ? order.delayRequests : [];
    order.delayRequests.push({ id: uid("delay"), reason: String(patch.reason || "Customer cannot receive now"), status: "pending", createdAt: now.toISOString() });
  }
  if (patch.action === "appeal") {
    order.appeals = Array.isArray(order.appeals) ? order.appeals : [];
    order.appeals.push({ id: uid("appeal"), reason: String(patch.reason || "Appeal requested"), status: "pending", createdAt: now.toISOString() });
  }
  if (patch.action === "create_return") duplicateServiceOrder(state, order, "return", now);
  if (patch.action === "create_replacement") duplicateServiceOrder(state, order, "replacement", now, patch.replacementOrderNumber);
  if (patch.action === "approve_request") approveRequest(order, patch.requestId, now);
  if (patch.action === "reject_request") rejectRequest(order, patch.requestId);

  if (order.status === "accepted" && isLate(order, now)) order.status = "late";
  order.updatedAt = now.toISOString();
  order.history = Array.isArray(order.history) ? order.history : [];
  order.history.push({ at: now.toISOString(), action: patch.action || "updated" });
}

function duplicateServiceOrder(state, source, flowType, now, replacementOrderNumber = "") {
  if (flowType === "replacement" && !String(replacementOrderNumber || "").trim()) {
    throw new Error("رقم طلب الاستبدال مطلوب.");
  }
  state.orders.unshift({
    ...source,
    id: uid("ord"),
    flowType,
    kind: "customer",
    type: flowType === "return" ? "Return" : "Replacement",
    returnedOrderNumber: source.returnedOrderNumber || source.number,
    replacementOrderNumber: flowType === "replacement" ? String(replacementOrderNumber).trim() : "",
    sourceOrderId: source.id,
    status: source.driverId ? "accepted" : "new",
    acceptedAt: source.driverId ? now.toISOString() : "",
    deadlineAt: source.driverId ? new Date(now.getTime() + DAY_MS).toISOString() : "",
    completedAt: "",
    cutRemoved: false,
    delayRequests: [],
    appeals: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    history: [{ at: now.toISOString(), action: `created_${flowType}` }]
  });
}

function acceptOrder(order, now) {
  order.status = "accepted";
  order.acceptedAt = now.toISOString();
  const hours = order.kind === "custom" ? Number(order.timerHours || 24) : 24;
  order.deadlineAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function approveRequest(order, requestId, now) {
  const request = findRequest(order, requestId);
  if (!request) return;
  request.status = "approved";
  request.reviewedAt = now.toISOString();
  order.status = "accepted";
  order.deadlineAt = new Date(now.getTime() + DAY_MS).toISOString();
  order.cutRemoved = true;
}

function rejectRequest(order, requestId) {
  const request = findRequest(order, requestId);
  if (request) request.status = "rejected";
}

function findRequest(order, requestId) {
  return [...(order.delayRequests || []), ...(order.appeals || [])].find((request) => request.id === requestId);
}

function isLate(order, now = new Date()) {
  return order.deadlineAt && now.getTime() > new Date(order.deadlineAt).getTime() && !order.cutRemoved;
}

function markLateOrders(state) {
  state.orders.forEach((order) => {
    if (order.status === "accepted" && isLate(order)) order.status = "late";
  });
}

async function handleApi(req, res, url) {
  const state = await readState();

  if (url.pathname === "/api/health") {
    send(res, 200, { ok: true, storage: useSupabase() ? "supabase" : "json" });
    return true;
  }

  if (url.pathname === "/api/state" && req.method === "GET") {
    send(res, 200, publicState(state));
    return true;
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const user = state.users.find((item) => item.username.toLowerCase() === username && item.password === password);
    if (!user) {
      send(res, 401, { ok: false, message: "Invalid username or password." });
      return true;
    }
    send(res, 200, { ok: true, user: publicUser(user) });
    return true;
  }

  if (url.pathname === "/api/reset" && req.method === "POST") {
    const initial = seedState();
    await writeState(initial);
    send(res, 200, publicState(initial));
    return true;
  }

  if (url.pathname === "/api/accounts" && req.method === "POST") {
    createAccount(state, await readBody(req));
    await writeState(state);
    send(res, 201, publicState(state));
    return true;
  }

  if (url.pathname === "/api/orders" && req.method === "POST") {
    createOrder(state, await readBody(req));
    await writeState(state);
    send(res, 201, publicState(state));
    return true;
  }

  const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderMatch && req.method === "PATCH") {
    updateOrderState(state, decodeURIComponent(orderMatch[1]), await readBody(req));
    await writeState(state);
    send(res, 200, publicState(state));
    return true;
  }

  return false;
}

async function serveStatic(req, res) {
  const requestPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const safePath = requestPath === "/" ? "/index.html" : decodeURIComponent(requestPath);
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  try {
    const body = await fs.readFile(filePath);
    send(res, 200, body, MIME[path.extname(filePath)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/") && (await handleApi(req, res, url))) return;
    await serveStatic(req, res);
  } catch (error) {
    send(res, 500, { ok: false, message: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Hasinah running at http://localhost:${PORT}`);
});
