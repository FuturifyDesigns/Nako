import { promptInstall, registerServiceWorker } from "./install.js";
import { applyLandingI18n, initLang, t, toggleLang } from "./i18n.js";
import { mountPassenger } from "./passenger.js";
import { isHandheld, isStandalone } from "./session.js";
import { startSync, track } from "./sync.js";

initLang();
registerServiceWorker("../sw.js");

const handheld = isHandheld();
const installed = isStandalone() || document.documentElement.dataset.mode === "app";

if (installed) {
  mountPassenger(document.querySelector("#app"));
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
