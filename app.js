const STORAGE_KEY = "hasinah_clean_dispatch_v1";
const SESSION_KEY = "hasinah_clean_session_v1";
const GARMENTS_URL = "https://theunkown901-gif.github.io/garmentyahya/";

let state = loadState();
let session = loadSession();
let currentView = "home";

const els = {
  loginView: document.querySelector("#loginView"),
  appView: document.querySelector("#appView"),
  loginForm: document.querySelector("#loginForm"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  loginError: document.querySelector("#loginError"),
  logoutBtn: document.querySelector("#logoutBtn"),
  sessionName: document.querySelector("#sessionName"),
  viewTitle: document.querySelector("#viewTitle"),
  orderForm: document.querySelector("#orderForm"),
  driverForm: document.querySelector("#driverForm"),
  driverSelect: document.querySelector("#driverSelect"),
  driversList: document.querySelector("#driversList"),
  ordersList: document.querySelector("#ordersList"),
  statusFilter: document.querySelector("#statusFilter")
};

document.querySelectorAll(".nav-tab[data-view]").forEach((tab) => {
  tab.addEventListener("click", () => setView(tab.dataset.view));
});

document.querySelectorAll("[data-view-jump]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewJump));
});

els.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = els.username.value.trim().toLowerCase();
  const password = els.password.value.trim();
  const user = state.users.find((item) => item.username === username && item.password === password);
  if (!user) {
    els.loginError.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة.";
    return;
  }
  session = { userId: user.id };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  els.loginForm.reset();
  boot();
});

els.logoutBtn.addEventListener("click", () => {
  session = null;
  localStorage.removeItem(SESSION_KEY);
  showLogin();
});

els.driverForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#driverName").value.trim();
  const username = document.querySelector("#driverUsername").value.trim().toLowerCase();
  const password = document.querySelector("#driverPassword").value.trim();
  if (!name || !username || !password) return;
  if (state.users.some((user) => user.username === username)) {
    alert("اسم المستخدم موجود مسبقا.");
    return;
  }
  state.users.push({ id: uid("drv"), role: "driver", name, username, password });
  saveState();
  els.driverForm.reset();
  render();
});

els.orderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(els.orderForm);
  const driverId = String(form.get("driverId") || "");
  state.orders.unshift({
    id: uid("ord"),
    number: String(form.get("number")).trim(),
    customer: String(form.get("customer")).trim(),
    phone: cleanPhone(form.get("phone")),
    area: String(form.get("area")).trim(),
    type: String(form.get("type")),
    driverId,
    status: driverId ? "assigned" : "new",
    createdAt: new Date().toISOString()
  });
  saveState();
  els.orderForm.reset();
  render();
});

els.statusFilter.addEventListener("change", renderOrders);

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function cleanPhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function whatsappLink(phone) {
  const normalized = cleanPhone(phone);
  const international = normalized.startsWith("966") ? normalized : `966${normalized.replace(/^0/, "")}`;
  return `https://wa.me/${international}`;
}

function seedState() {
  return {
    users: [{ id: "admin-yahya", role: "admin", name: "يحيى", username: "yahya", password: "123123" }],
    orders: []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved?.users) && Array.isArray(saved?.orders)) return saved;
  } catch {
    // Use seed.
  }
  return seedState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function currentUser() {
  return state.users.find((user) => user.id === session?.userId);
}

function drivers() {
  return state.users.filter((user) => user.role === "driver");
}

function showLogin() {
  els.loginView.classList.remove("hidden");
  els.appView.classList.add("hidden");
}

function boot() {
  const user = currentUser();
  if (!user) {
    showLogin();
    return;
  }
  els.loginView.classList.add("hidden");
  els.appView.classList.remove("hidden");
  els.sessionName.textContent = `${user.name} - ${user.role === "admin" ? "مدير" : "سائق"}`;
  setView(user.role === "driver" ? "dispatch" : "home");
}

function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-tab[data-view]").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("active-view", section.id === `${view}View`));
  els.viewTitle.textContent = { home: "الرئيسية", dispatch: "التوصيل" }[view] || "الرئيسية";
  render();
}

function render() {
  renderDrivers();
  renderOrders();
}

function renderDrivers() {
  const options = ['<option value="">غير مسند</option>', ...drivers().map((driver) => `<option value="${driver.id}">${escapeHtml(driver.name)}</option>`)].join("");
  els.driverSelect.innerHTML = options;
  els.driversList.innerHTML = drivers().length
    ? drivers().map((driver) => `<article class="driver-card"><strong>${escapeHtml(driver.name)}</strong><span>${escapeHtml(driver.username)} / ${escapeHtml(driver.password)}</span></article>`).join("")
    : `<article class="driver-card"><strong>لا يوجد سائقون</strong><span>أضف أول سائق من النموذج.</span></article>`;
}

function renderOrders() {
  const user = currentUser();
  const status = els.statusFilter.value;
  let orders = user?.role === "driver" ? state.orders.filter((order) => order.driverId === user.id) : state.orders;
  if (status !== "all") orders = orders.filter((order) => order.status === status);
  els.ordersList.innerHTML = orders.length
    ? orders.map(renderOrderCard).join("")
    : `<article class="order-card"><strong>لا توجد طلبات</strong><span>ستظهر الطلبات هنا بعد إضافتها.</span></article>`;
  els.ordersList.querySelectorAll("[data-done]").forEach((button) => {
    button.addEventListener("click", () => {
      const order = state.orders.find((item) => item.id === button.dataset.done);
      if (order) order.status = "done";
      saveState();
      renderOrders();
    });
  });
}

function renderOrderCard(order) {
  const driver = drivers().find((item) => item.id === order.driverId);
  const labels = { delivery: "توصيل", return: "إرجاع", replacement: "استبدال" };
  const status = { new: "جديد", assigned: "مسند", done: "منجز" };
  return `
    <article class="order-card">
      <strong>${escapeHtml(order.number)} - ${escapeHtml(order.customer)}</strong>
      <span>${escapeHtml(order.area)} | ${labels[order.type] || order.type} | ${status[order.status] || order.status}</span>
      <span>السائق: ${escapeHtml(driver?.name || "غير مسند")}</span>
      <div class="card-actions">
        <a class="mini-btn" href="${whatsappLink(order.phone)}" target="_blank" rel="noreferrer">واتساب</a>
        ${order.status !== "done" ? `<button class="mini-btn" data-done="${order.id}" type="button">تم الإنجاز</button>` : ""}
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

boot();
