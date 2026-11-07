import { canPromptInstall, promptInstall, registerServiceWorker } from "./install.js";
import { t } from "./i18n.js";
import { isHandheld, isStandalone, platform } from "./session.js";
import { startSync, track, trackOnce } from "./sync.js";

if (isStandalone()) location.replace("./app/");

registerServiceWorker("./sw.js");
startSync();
trackOnce("info_view");

const button = document.querySelector("#install-button");
const desktopNote = document.querySelector("#desktop-install-note");
const help = document.querySelector("#install-help");
const handheld = isHandheld();

if (help) help.dataset.platform = platform();

if (!handheld) {
  if (button) {
    button.hidden = true;
    button.setAttribute("aria-hidden", "true");
  }
  if (desktopNote) desktopNote.hidden = false;
  document.body.dataset.device = "desktop";
} else {
  document.body.dataset.device = "handheld";
  if (desktopNote) desktopNote.hidden = true;
  button?.addEventListener("click", async () => {
    await track("install_click");
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      await track("install_accepted");
      button.textContent = t("downloadApp");
      return;
    }
    if (help) {
      help.hidden = false;
      help.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!canPromptInstall() && help) help.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  window.addEventListener("nako-install-ready", () => {
    if (button) button.textContent = t("downloadApp");
  });
}
