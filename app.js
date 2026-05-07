const PORTAL_SESSION_KEY = "hasinah-portal-session-v1";

const portalLogin = document.querySelector("#portalLogin");
const portalHub = document.querySelector("#portalHub");
const portalLoginForm = document.querySelector("#portalLoginForm");
const portalUsername = document.querySelector("#portalUsername");
const portalPassword = document.querySelector("#portalPassword");
const portalError = document.querySelector("#portalError");
const portalLogout = document.querySelector("#portalLogout");

function showHub() {
  portalLogin.classList.add("hidden");
  portalHub.classList.remove("hidden");
}

function showLogin() {
  portalHub.classList.add("hidden");
  portalLogin.classList.remove("hidden");
}

portalLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = portalUsername.value.trim().toLowerCase();
  const password = portalPassword.value.trim();
  if (username !== "yahya" || password !== "123123") {
    portalError.textContent = "اسم المستخدم أو كلمة المرور غير صحيحة.";
    return;
  }
  localStorage.setItem(PORTAL_SESSION_KEY, "yes");
  portalError.textContent = "";
  portalLoginForm.reset();
  showHub();
});

portalLogout.addEventListener("click", () => {
  localStorage.removeItem(PORTAL_SESSION_KEY);
  showLogin();
});

if (localStorage.getItem(PORTAL_SESSION_KEY) === "yes") {
  showHub();
} else {
  showLogin();
}
