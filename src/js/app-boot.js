import { promptInstall, registerServiceWorker } from "./install.js";
import { mountPassenger } from "./passenger.js";
import { startSync, track } from "./sync.js";

registerServiceWorker("../sw.js");

if (document.documentElement.dataset.mode === "app") {
  mountPassenger(document.querySelector("#app"));
} else {
  startSync();
  const button = document.querySelector("#install-button");
  const help = document.querySelector("#install-help");
  button?.addEventListener("click", async () => {
    await track("install_click");
    const outcome = await promptInstall();
    if (outcome === "accepted") await track("install_accepted");
    if (help) help.hidden = false;
  });
}
