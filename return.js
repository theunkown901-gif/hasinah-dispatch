const form = document.querySelector("#returnForm");
const checkBtn = document.querySelector("#checkBtn");
const submitBtn = document.querySelector("#submitBtn");
const detailsStep = document.querySelector("#detailsStep");
const eligibilityBox = document.querySelector("#eligibilityBox");
const productsList = document.querySelector("#productsList");
const coveredSteps = document.querySelector("#coveredSteps");
const evidencePage = document.querySelector("#evidencePage");
const evidenceHint = document.querySelector("#evidenceHint");
const evidenceFiles = document.querySelector("#evidenceFiles");
const evidencePreview = document.querySelector("#evidencePreview");
const backToDetailsBtn = document.querySelector("#backToDetailsBtn");
const continueShippingBtn = document.querySelector("#continueShippingBtn");
const shippingPage = document.querySelector("#shippingPage");
const shippingCity = document.querySelector("#shippingCity");
const nearestBranchBtn = document.querySelector("#nearestBranchBtn");
const finalSubmitBtn = document.querySelector("#finalSubmitBtn");
const locationMessage = document.querySelector("#locationMessage");
const successPage = document.querySelector("#successPage");
const successMessage = document.querySelector("#successMessage");
const successRequestId = document.querySelector("#successRequestId");
const successOrderNumber = document.querySelector("#successOrderNumber");
const successProducts = document.querySelector("#successProducts");
const newRequestBtn = document.querySelector("#newRequestBtn");
const progressStrip = document.querySelector("#progressStrip");
const progressItems = document.querySelectorAll(".progress-strip span");
const toast = document.querySelector("#toast");

let verifiedOrder = null;
let pendingPayload = null;
let evidenceNames = [];

const ADMIN_ORDERS_KEY = "hasinah-return-admin-orders-v1";
const TEST_ORDER_NUMBER = "1234512345";
const TEST_PRODUCTS = [
  { id: "test-product-1", name: "منتج تجريبي ١", sku: "TEST-001", quantity: 1 },
  { id: "test-product-2", name: "منتج تجريبي ٢", sku: "TEST-002", quantity: 1 }
];

const evidenceReasons = new Set(["المقاس المستلم غير صحيح", "اللون مختلف", "وصلني منتج آخر", "يوجد عيب في المنتج"]);

const branchLocations = {
  SMSA: [
    { city: "الرياض", lat: 24.7136, lng: 46.6753 },
    { city: "جدة", lat: 21.5433, lng: 39.1728 },
    { city: "الدمام", lat: 26.4207, lng: 50.0888 }
  ],
  AJEX: [
    { city: "الرياض", lat: 24.7743, lng: 46.7386 },
    { city: "جدة", lat: 21.4858, lng: 39.1925 },
    { city: "الخبر", lat: 26.2172, lng: 50.1971 }
  ],
  Aramex: [
    { city: "الرياض", lat: 24.6877, lng: 46.7219 },
    { city: "جدة", lat: 21.5595, lng: 39.1918 },
    { city: "المدينة المنورة", lat: 24.5247, lng: 39.5692 }
  ],
  FedEx: [
    { city: "الرياض", lat: 24.8065, lng: 46.6427 },
    { city: "جدة", lat: 21.6126, lng: 39.1567 },
    { city: "الدمام", lat: 26.3927, lng: 49.9777 }
  ]
};

checkBtn.addEventListener("click", verifyOrder);
form.addEventListener("submit", handleDetailsSubmit);
evidenceFiles.addEventListener("change", renderEvidencePreview);
backToDetailsBtn.addEventListener("click", showDetails);
continueShippingBtn.addEventListener("click", handleEvidenceContinue);
nearestBranchBtn.addEventListener("click", checkNearestBranches);
finalSubmitBtn.addEventListener("click", finalizeRequest);
document.querySelector("#customerName").addEventListener("input", resetVerification);
document.querySelector("#orderNumber").addEventListener("input", resetVerification);
newRequestBtn.addEventListener("click", resetAll);

async function verifyOrder() {
  const customerName = form.customerName.value.trim();
  const orderNumber = form.orderNumber.value.trim();
  if (!customerName || !orderNumber) {
    setBox("error", "بيانات ناقصة", "اكتبي الاسم ورقم الطلب أولًا.");
    return;
  }

  if (isTestOrder(orderNumber)) {
    verifiedOrder = {
      ok: true,
      eligible: true,
      message: "طلب اختبار مؤهل بدون ربط زِد.",
      order: {
        id: "test-order",
        number: TEST_ORDER_NUMBER,
        status: "تم التسليم",
        updatedAt: new Date().toISOString(),
        hoursLeft: 24,
        customerName,
        products: TEST_PRODUCTS
      }
    };
    detailsStep.disabled = false;
    renderProducts(TEST_PRODUCTS);
    setProgress(1);
    setBox("success", "الطلب مؤهل", "هذا رقم طلب تجريبي معتمد لاختبار سير التطبيق قبل ربط زِد.");
    return;
  }

  checkBtn.disabled = true;
  checkBtn.textContent = "جاري التحقق";
  setProgress(0);
  setBox("checking", "جاري التحقق", "نراجع آخر حالة للطلب في زِد ووقت آخر تحديث.");

  try {
    const response = await fetch("/api/returns/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName, orderNumber })
    });
    const result = await response.json();
    verifiedOrder = result;

    if (!result.eligible) {
      detailsStep.disabled = true;
      renderProducts([]);
      setBox("error", "الطلب غير مؤهل", result.message || "لا يمكن إرسال طلب إرجاع أو استبدال لهذا الطلب.");
      return;
    }

    detailsStep.disabled = false;
    renderProducts(result.order?.products || []);
    setProgress(1);
    setBox("success", "الطلب مؤهل", `تبقى تقريبًا ${result.order.hoursLeft} ساعة داخل المهلة. يمكنك الآن إكمال التفاصيل.`);
  } catch (error) {
    verifiedOrder = null;
    detailsStep.disabled = true;
    renderProducts([]);
    setBox("error", "تعذر التحقق", error.message || "حدث خطأ غير متوقع.");
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = "تحقق من الأهلية";
  }
}

function handleDetailsSubmit(event) {
  event.preventDefault();
  if (!verifiedOrder?.eligible) {
    showToast("تحققي من الطلب قبل المتابعة.");
    return;
  }

  const payload = collectPayload();
  if (!payload.requestType) {
    showToast("اختاري إرجاع أو استبدال.");
    return;
  }
  if (!payload.selectedProducts.length) {
    showToast("اختاري منتجًا واحدًا على الأقل.");
    return;
  }
  if (!payload.phone || !payload.reason) {
    showToast("أكملي رقم الجوال وسبب الطلب.");
    return;
  }

  pendingPayload = payload;
  if (needsEvidence(payload.reason)) {
    showEvidence(payload.reason);
  } else {
    showShipping();
  }
}

function showEvidence(reason) {
  form.hidden = true;
  shippingPage.hidden = true;
  successPage.hidden = true;
  evidencePage.hidden = false;
  evidenceHint.textContent = evidenceText(reason);
  evidenceFiles.value = "";
  evidenceNames = [];
  renderEvidencePreview();
}

function showDetails() {
  evidencePage.hidden = true;
  shippingPage.hidden = true;
  successPage.hidden = true;
  form.hidden = false;
}

async function handleEvidenceContinue() {
  const files = Array.from(evidenceFiles.files || []);
  if (!files.length) {
    showToast("ارفعي صورة واحدة على الأقل قبل المتابعة.");
    return;
  }

  continueShippingBtn.disabled = true;
  continueShippingBtn.textContent = "جاري تجهيز الصور";
  try {
    evidenceNames = await Promise.all(files.map(readEvidenceFile));
  } catch {
    showToast("تعذر تجهيز الصور. جربي صورًا أصغر حجمًا.");
    return;
  } finally {
    continueShippingBtn.disabled = false;
    continueShippingBtn.textContent = "متابعة للشحن";
  }
  showShipping();
}

function showShipping() {
  form.hidden = true;
  evidencePage.hidden = true;
  successPage.hidden = true;
  shippingPage.hidden = false;
  setProgress(1);
}

async function checkNearestBranches() {
  if (isTestOrder(pendingPayload?.orderNumber || "")) {
    Object.entries(branchLocations).forEach(([company, branches], index) => {
      const branch = branches[index % branches.length];
      document.querySelector(`#distance-${company}`).textContent = `${(1.8 + index * 1.4).toFixed(1)} كم تقريبًا - أقرب فرع في ${branch.city}`;
    });
    locationMessage.textContent = "تم حساب مسافات تجريبية بدون طلب إذن الموقع.";
    return;
  }

  if (!navigator.geolocation) {
    locationMessage.textContent = "المتصفح لا يدعم تحديد الموقع.";
    return;
  }

  nearestBranchBtn.disabled = true;
  nearestBranchBtn.textContent = "جاري حساب المسافة";
  locationMessage.textContent = "سيظهر طلب إذن الموقع من المتصفح الآن.";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const user = { lat: position.coords.latitude, lng: position.coords.longitude };
      Object.entries(branchLocations).forEach(([company, branches]) => {
        const nearest = branches
          .map((branch) => ({ ...branch, distance: distanceKm(user, branch) }))
          .sort((a, b) => a.distance - b.distance)[0];
        document.querySelector(`#distance-${company}`).textContent = `${nearest.distance.toFixed(1)} كم تقريبًا - أقرب فرع في ${nearest.city}`;
      });
      locationMessage.textContent = "تم حساب المسافة التقريبية لأقرب فرع لكل شركة.";
      nearestBranchBtn.disabled = false;
      nearestBranchBtn.textContent = "تحديث أقرب فرع لي";
    },
    () => {
      locationMessage.textContent = "لم يتم السماح بالموقع. يمكنك اختيار شركة الشحن يدويًا.";
      nearestBranchBtn.disabled = false;
      nearestBranchBtn.textContent = "تحقق من أقرب فرع لي";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

async function finalizeRequest() {
  if (!pendingPayload) {
    showToast("أكملي تفاصيل الطلب أولًا.");
    return;
  }

  const company = document.querySelector('input[name="shippingCompany"]:checked')?.value || "";
  if (!shippingCity.value) {
    showToast("اختاري المدينة داخل السعودية.");
    return;
  }
  if (!company) {
    showToast("اختاري شركة الشحن.");
    return;
  }

  const finalPayload = {
    ...pendingPayload,
    evidenceFiles: evidenceNames,
    shippingCity: shippingCity.value,
    shippingCompany: company
  };

  finalSubmitBtn.disabled = true;
  finalSubmitBtn.textContent = "جاري الإرسال";

  try {
    if (!isTestOrder(finalPayload.orderNumber) && location.protocol !== "file:") {
      const response = await fetch("/api/returns/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(finalPayload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || "تعذر إرسال الطلب.");
      showSuccess({ ...finalPayload, requestId: result.requestId });
      return;
    }

    showSuccess({
      ...finalPayload,
      requestId: `RET-${Date.now().toString(36).toUpperCase()}`
    });
  } catch (error) {
    showToast(error.message);
  } finally {
    finalSubmitBtn.disabled = false;
    finalSubmitBtn.textContent = "إرسال الطلب للمراجعة";
  }
}

function showSuccess(result) {
  setProgress(2);
  saveAdminOrder(result);
  form.hidden = true;
  evidencePage.hidden = true;
  shippingPage.hidden = true;
  form.classList.add("is-submitted");
  successPage.hidden = false;
  successMessage.textContent = `تم إرسال طلبك وسيتم مراجعته. سيصل مندوب ${companyArabic(result.shippingCompany)} إلى منزلك خلال 48 ساعة لاستلام الطلب. نرجو إعادة تغليف المنتج وتجهيزه للاستلام. إذا لم يتواصل معك المندوب أو لم يصل خلال 48 ساعة، تواصلي معنا عبر رقم الواتساب الخاص بنا للمساعدة وإرشادك لتسليم الطلب في أقرب فرع. شكرًا لك ونتمنى لك يومًا جميلًا.`;
  successRequestId.textContent = result.requestId || "-";
  successOrderNumber.textContent = result.orderNumber || verifiedOrder?.order?.number || "-";
  successProducts.textContent = result.selectedProducts.map((product) => product.name || product.id).join("، ") || "-";
  showToast("تم إرسال الطلب بنجاح.");
}

function saveAdminOrder(order) {
  const orders = loadAdminOrders();
  orders.unshift({
    id: order.requestId || `RET-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "جديد",
    customerName: order.customerName,
    phone: order.phone,
    orderNumber: order.orderNumber,
    requestType: order.requestType,
    reason: order.reason,
    notes: order.notes,
    selectedProducts: order.selectedProducts || [],
    evidenceFiles: order.evidenceFiles || [],
    shippingCity: order.shippingCity,
    shippingCompany: order.shippingCompany
  });
  localStorage.setItem(ADMIN_ORDERS_KEY, JSON.stringify(orders.slice(0, 80)));
}

function loadAdminOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(ADMIN_ORDERS_KEY) || "[]");
    return Array.isArray(orders) ? orders : [];
  } catch {
    return [];
  }
}

function resetVerification() {
  if (!verifiedOrder) return;
  verifiedOrder = null;
  pendingPayload = null;
  detailsStep.disabled = true;
  renderProducts([]);
  setProgress(0);
  setBox("waiting", "بانتظار التحقق", "تم تعديل بيانات الطلب. تحققي مرة أخرى قبل المتابعة.");
}

function resetAll() {
  successPage.hidden = true;
  evidencePage.hidden = true;
  shippingPage.hidden = true;
  form.hidden = false;
  form.classList.remove("is-submitted");
  form.reset();
  shippingCity.value = "";
  document.querySelectorAll('input[name="shippingCompany"]').forEach((input) => {
    input.checked = false;
  });
  Object.keys(branchLocations).forEach((company) => {
    document.querySelector(`#distance-${company}`).textContent = "المسافة غير محسوبة";
  });
  locationMessage.textContent = "سيطلب المتصفح إذن الموقع عند الضغط على زر أقرب فرع.";
  verifiedOrder = null;
  pendingPayload = null;
  evidenceNames = [];
  detailsStep.disabled = true;
  renderProducts([]);
  renderEvidencePreview();
  setProgress(0);
  setBox("waiting", "بانتظار التحقق", "سيتم التأكد من أن آخر حالة في زِد هي تم التسليم وأن آخر تحديث لم يتجاوز 24 ساعة.");
}

function collectPayload() {
  const formData = new FormData(form);
  return {
    customerName: String(formData.get("customerName") || "").trim(),
    orderNumber: String(formData.get("orderNumber") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    requestType: String(formData.get("requestType") || "").trim(),
    reason: String(formData.get("reason") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
    selectedProducts: formData.getAll("selectedProducts").map((productId) => {
      const product = (verifiedOrder?.order?.products || []).find((item) => item.id === productId);
      return product || { id: productId, name: productId };
    })
  };
}

function renderProducts(products) {
  if (!products.length) {
    productsList.innerHTML = '<p class="product-empty">ستظهر المنتجات هنا بعد التحقق من الطلب.</p>';
    return;
  }

  productsList.innerHTML = products
    .map((product, index) => {
      const id = escapeHtml(product.id || `product-${index}`);
      const name = escapeHtml(product.name || "منتج بدون اسم");
      const sku = product.sku ? `<small>رمز المنتج: ${escapeHtml(product.sku)}</small>` : "";
      const quantity = product.quantity ? `<small>الكمية المتاحة: ${escapeHtml(product.quantity)}</small>` : "";
      return `
        <label class="product-option">
          <input type="checkbox" name="selectedProducts" value="${id}" />
          <span>
            <strong>${name}</strong>
            ${sku}
            ${quantity}
          </span>
        </label>
      `;
    })
    .join("");
}

function renderEvidencePreview() {
  const files = Array.from(evidenceFiles.files || []);
  if (!files.length) {
    evidencePreview.innerHTML = '<span>لم يتم اختيار صور بعد.</span>';
    return;
  }

  evidencePreview.innerHTML = files
    .map((file) => `<span>${escapeHtml(file.name)}</span>`)
    .join("");
}

function readEvidenceFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setProgress(activeIndex) {
  const progress = progressItems.length > 1 ? (activeIndex / (progressItems.length - 1)) * 100 : 0;
  progressStrip.style.setProperty("--progress", `${progress}%`);
  coveredSteps.dataset.coverStep = String(activeIndex);
  progressItems.forEach((item, index) => {
    item.classList.toggle("active", index <= activeIndex);
    item.classList.toggle("done", index < activeIndex);
    item.classList.toggle("current", index === activeIndex);
  });
}

function setBox(mode, title, message) {
  eligibilityBox.className = `eligibility-box ${mode}`;
  eligibilityBox.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

function needsEvidence(reason) {
  return evidenceReasons.has(reason);
}

function evidenceText(reason) {
  if (reason === "يوجد عيب في المنتج") return "ارفعي صورًا واضحة للعيب أو الضرر من أكثر من زاوية.";
  if (reason === "المقاس المستلم غير صحيح") return "ارفعي صورة واضحة للمقاس المكتوب على الياقة أو بطاقة المقاس.";
  if (reason === "وصلني منتج آخر") return "ارفعي صورة للمنتج المستلم وصورة للملصق أو التغليف إن وجد.";
  if (reason === "اللون مختلف") return "ارفعي صورة واضحة للون المنتج تحت إضاءة طبيعية.";
  return "ارفعي صورًا توضّح سبب الطلب حتى نراجع الحالة بسرعة.";
}

function distanceKm(a, b) {
  const earth = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function companyArabic(company) {
  return {
    SMSA: "سمسا",
    AJEX: "أجكس",
    Aramex: "أرامكس",
    FedEx: "فيديكس"
  }[company] || company;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3600);
}

function normalizeOrderNumber(value) {
  return String(value).replace(/\s+/g, "");
}

function isTestOrder(value) {
  return normalizeOrderNumber(value) === TEST_ORDER_NUMBER;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

renderProducts([]);
renderEvidencePreview();
setProgress(0);
