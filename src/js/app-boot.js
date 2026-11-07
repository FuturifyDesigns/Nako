import { promptInstall, registerServiceWorker } from "./install.js";
import { applyLandingI18n, initLang, t, toggleLang } from "./i18n.js";
import { mountPassenger } from "./passenger.js";
import { isHandheld, isStandalone } from "./session.js";
import { startSync, track } from "./sync.js";

initLang();
registerServiceWorker("../sw.js");

const handheld = isHandheld();
const installed = isStandalone() || document.documentElement.dataset.mode === "app";
const splash = document.querySelector("#pwa-splash");
const roleChoiceKey = "nakolive-role-choice-v1";
const reopeningAsDriver = installed && localStorage.getItem(roleChoiceKey) === "driver";

// Keep an installed app in the last role selected. Supabase persists the
// authenticated session; this route returns signed-in drivers to their console.
if (reopeningAsDriver) {
  location.replace("../driver/?from=app");
}

if (splash && installed) {
  let dismissed = false;
  const dismissSplash = () => {
    if (dismissed) return;
    dismissed = true;
    splash.classList.add("is-leaving");
    window.setTimeout(() => splash.remove(), 420);
  };
  const scheduleDismiss = () => window.setTimeout(dismissSplash, 900);
  if (document.readyState === "complete") scheduleDismiss();
  else window.addEventListener("load", scheduleDismiss, { once: true });
  window.setTimeout(dismissSplash, 3500);
} else {
  splash?.remove();
}

if (reopeningAsDriver) {
  // Navigation is already in progress; do not mount either interface underneath it.
} else if (installed) {
  mountPassenger(document.querySelector("#app"));
  showRoleChoice();
} else {
  startSync();
  const handheldGate = document.querySelector("#gate-handheld");
  const desktopGate = document.querySelector("#gate-desktop");
  const button = document.querySelector("#install-button");
  const help = document.querySelector("#install-help");

  applyLandingI18n(document);
  const langBtn = document.createElement("button");
  langBtn.type = "button";
  langBtn.className = "lang-toggle";
  langBtn.textContent = t("otherLang");
  langBtn.addEventListener("click", () => {
    toggleLang();
    applyLandingI18n(document);
    langBtn.textContent = t("otherLang");
    if (button) button.textContent = t("downloadApp");
  });
  document.querySelector(".gate .brand")?.after(langBtn);

  if (!handheld) {
    if (handheldGate) handheldGate.hidden = true;
    if (desktopGate) desktopGate.hidden = false;
  } else {
    if (handheldGate) handheldGate.hidden = false;
    if (desktopGate) desktopGate.hidden = true;
    button?.addEventListener("click", async () => {
      await track("install_click");
      const outcome = await promptInstall();
      if (outcome === "accepted") await track("install_accepted");
      if (help) help.hidden = false;
    });
  }
}

function showRoleChoice() {
  const choiceKey = roleChoiceKey;
  if (localStorage.getItem(choiceKey)) return;

  const overlay = document.createElement("div");
  overlay.className = "role-choice-overlay";
  overlay.innerHTML = `
    <section class="role-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="role-choice-title">
      <img src="../assets/icons/nako-logo.png?v=10" width="112" height="85" alt="">
      <p class="role-choice-kicker">WELCOME TO NAKOLIVE</p>
      <h1 id="role-choice-title"></h1>
      <p class="role-choice-copy"></p>
      <div class="role-choice-actions">
        <button type="button" class="role-choice-option passenger-option">
          <span class="role-choice-icon" aria-hidden="true">P</span>
          <span><strong></strong><small></small></span>
          <b aria-hidden="true">→</b>
        </button>
        <a class="role-choice-option driver-option" href="../driver/?mode=register&from=app">
          <span class="role-choice-icon" aria-hidden="true">D</span>
          <span><strong></strong><small></small></span>
          <b aria-hidden="true">→</b>
        </a>
      </div>
      <p class="role-choice-note">Driver registration is available inside the installed app.</p>
    </section>`;

  overlay.querySelector("#role-choice-title").textContent = t("chooseModeTitle");
  overlay.querySelector(".role-choice-copy").textContent = t("chooseModeBody");
  overlay.querySelector(".passenger-option strong").textContent = t("continuePassenger");
  overlay.querySelector(".passenger-option small").textContent = t("passengerChoiceHint");
  overlay.querySelector(".driver-option strong").textContent = t("registerDriver");
  overlay.querySelector(".driver-option small").textContent = t("driverChoiceHint");
  overlay.querySelector(".passenger-option").addEventListener("click", () => {
    localStorage.setItem(choiceKey, "passenger");
    overlay.classList.add("is-leaving");
    window.setTimeout(() => overlay.remove(), 260);
  });
  overlay.querySelector(".driver-option").addEventListener("click", () => localStorage.setItem(choiceKey, "driver"));
  document.body.append(overlay);
  window.setTimeout(() => overlay.querySelector(".passenger-option")?.focus(), 1050);
}
