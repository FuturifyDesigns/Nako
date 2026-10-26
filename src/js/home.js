import { canPromptInstall, promptInstall, registerServiceWorker } from "./install.js";
import { platform, isStandalone } from "./session.js";
import { startSync, track, trackOnce } from "./sync.js";

if (isStandalone()) location.replace("./app/");

registerServiceWorker("./sw.js");
startSync();
trackOnce("info_view");

const button = document.querySelector("#install-button");
const help = document.querySelector("#install-help");
help.dataset.platform = platform();

button.addEventListener("click", async () => {
  await track("install_click");
  const outcome = await promptInstall();
  if (outcome === "accepted") {
    await track("install_accepted");
    button.textContent = "Install confirmed";
    return;
  }
  help.hidden = false;
  if (!canPromptInstall()) help.scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("nako-install-ready", () => {
  button.textContent = "Download the app";
});
