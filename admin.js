const passwordInput = document.querySelector("#adminPassword");
const adminLoginBtn = document.querySelector("#adminLoginBtn");
const loginError = document.querySelector("#loginError");
const loginView = document.querySelector("#loginView");
const ordersView = document.querySelector("#ordersView");
const ordersList = document.querySelector("#ordersList");
const logoutBtn = document.querySelector("#logoutBtn");
const filters = document.querySelectorAll(".filter");
const denyModal = document.querySelector("#denyModal");
const denyReason = document.querySelector("#denyReason");
const cancelDenyBtn = document.querySelector("#cancelDenyBtn");
const confirmDenyBtn = document.querySelector("#confirmDenyBtn");

const ADMIN_PASSWORD = "yahyabig";
const ADMIN_ORDERS_KEY = "hasinah-return-admin-orders-v1";
const ADMIN_SESSION_KEY = "hasinah-return-admin-session-v1";

let activeFilter = "all";
let pendingDenyId = "";

adminLoginBtn.addEventListener("click", login);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
logoutBtn.addEventListener("click", logout);
cancelDenyBtn.addEventListener("click", closeDenyModal);
confirmDenyBtn.addEventListener("click", confirmDeny);
filters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filters.forEach((item) => item.classList.toggle("active", item === button));
    renderOrders();
  });
});

if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") showOrders();

function login() {
  if (passwordInput.value !== ADMIN_PASSWORD) {
    loginError.textContent = "كلمة المرور غير صحيحة.";
    return;
  }
  sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
  passwordInput.value = "";
  loginError.textContent = "";
  showOrders();
}

function logout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  ordersView.hidden = true;
  loginView.hidden = false;
}

function showOrders() {
  loginView.hidden = true;
  ordersView.hidden = false;
  renderOrders();
}

function loadOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(ADMIN_ORDERS_KEY) || "[]");
    return Array.isArray(orders) ? orders : [];
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem(ADMIN_ORDERS_KEY, JSON.stringify(orders));
}

function renderOrders() {
  const orders = loadOrders().filter((order) => activeFilter === "all" || (order.status || "جديد") === activeFilter);
  if (!orders.length) {
    ordersList.innerHTML = '<p class="empty">لا توجد طلبات مطابقة.</p>';
    return;
  }

  ordersList.innerHTML = orders
    .map((order) => {
      const products = (order.selectedProducts || []).map((product) => product.name || product.id).join("، ") || "-";
      const evidence = renderEvidence(order.evidenceFiles || []);
      return `
        <article class="order-card">
          <div class="order-head">
            <div>
              <strong>${escapeHtml(order.id)}</strong>
              <span>${formatDate(order.createdAt)}</span>
            </div>
            <mark>${escapeHtml(order.status || "جديد")}</mark>
          </div>
          <dl>
            <div><dt>العميل</dt><dd>${escapeHtml(order.customerName || "-")}</dd></div>
            <div><dt>الجوال</dt><dd>${escapeHtml(order.phone || "-")}</dd></div>
            <div><dt>رقم الطلب</dt><dd>${escapeHtml(order.orderNumber || "-")}</dd></div>
            <div><dt>النوع</dt><dd>${escapeHtml(order.requestType || "-")}</dd></div>
            <div><dt>السبب</dt><dd>${escapeHtml(order.reason || "-")}</dd></div>
            <div><dt>المنتجات</dt><dd>${escapeHtml(products)}</dd></div>
            <div><dt>الإثباتات</dt><dd>${evidence}</dd></div>
            <div><dt>المدينة</dt><dd>${escapeHtml(order.shippingCity || "-")}</dd></div>
            <div><dt>شركة الشحن</dt><dd>${escapeHtml(companyArabic(order.shippingCompany) || "-")}</dd></div>
            <div><dt>سبب الرفض</dt><dd>${escapeHtml(order.denyReason || "-")}</dd></div>
          </dl>
          <div class="order-actions">
            <button class="approve" data-action="approve" data-id="${escapeHtml(order.id)}" type="button">قبول</button>
            <button class="deny" data-action="deny" data-id="${escapeHtml(order.id)}" type="button">رفض</button>
            <button class="skip" data-action="skip" data-id="${escapeHtml(order.id)}" type="button">تأجيل للتواصل</button>
          </div>
        </article>
      `;
    })
    .join("");

  ordersList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset.id));
  });
}

function handleAction(action, id) {
  if (action === "approve") {
    updateOrder(id, { status: "مقبول", denyReason: "" });
    return;
  }
  if (action === "skip") {
    updateOrder(id, { status: "بانتظار التواصل" });
    return;
  }
  pendingDenyId = id;
  denyReason.value = "";
  denyModal.hidden = false;
  denyReason.focus();
}

function confirmDeny() {
  const reason = denyReason.value.trim();
  if (!reason) {
    denyReason.focus();
    return;
  }
  updateOrder(pendingDenyId, { status: "مرفوض", denyReason: reason });
  closeDenyModal();
}

function closeDenyModal() {
  pendingDenyId = "";
  denyModal.hidden = true;
}

function updateOrder(id, patch) {
  const orders = loadOrders().map((order) => (order.id === id ? { ...order, ...patch, reviewedAt: new Date().toISOString() } : order));
  saveOrders(orders);
  renderOrders();
}

function renderEvidence(files) {
  if (!files.length) return "لا يوجد";
  return `
    <div class="evidence-links">
      ${files
        .map((file, index) => {
          if (typeof file === "string") return `<span>${escapeHtml(file)}</span>`;
          const label = escapeHtml(file.name || `صورة ${index + 1}`);
          if (!file.dataUrl) return `<span>${label}</span>`;
          return `
            <a href="${file.dataUrl}" target="_blank" rel="noopener">
              <img src="${file.dataUrl}" alt="${label}" />
              <span>${label}</span>
            </a>
          `;
        })
        .join("")}
    </div>
  `;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function companyArabic(company) {
  return {
    SMSA: "سمسا",
    AJEX: "أجكس",
    Aramex: "أرامكس",
    FedEx: "فيديكس"
  }[company] || company;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
