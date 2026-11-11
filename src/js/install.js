let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  window.dispatchEvent(new Event("nako-install-ready"));
});

export function canPromptInstall() {
  return Boolean(deferredPrompt);
}

export async function promptInstall() {
  if (!deferredPrompt) return "unavailable";
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome;
}

export function showInstallInstructions({ appHref = "./app/" } = {}) {
  document.querySelector(".install-dialog-overlay")?.remove();
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) {
    location.href = appHref;
    return;
  }
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const logoUrl = new URL("../../assets/icons/nako-logo.png?v=10", import.meta.url).href;
  const overlay = document.createElement("div");
  overlay.className = "install-dialog-overlay";
  overlay.innerHTML = `
    <section class="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-dialog-title">
      <button class="install-dialog-close" type="button" aria-label="Close">×</button>
      <img src="${logoUrl}" width="84" height="64" alt="">
      <p class="install-dialog-kicker">INSTALL NAKOLIVE</p>
      <h2 id="install-dialog-title">${ios ? "Add NakoLive to your Home Screen" : "Install NakoLive on this phone"}</h2>
      <p>${ios
        ? "Tap the Share button in your browser, then choose Add to Home Screen and confirm Add."
        : "Open this page in Chrome, tap the browser menu, then choose Install app or Add to Home screen."}</p>
      <p class="install-dialog-note">If NakoLive is already installed, open it from your phone’s Home Screen.</p>
      <button class="find install-dialog-done" type="button">Okay</button>
    </section>`;
  const close = () => overlay.remove();
  overlay.querySelector(".install-dialog-close").addEventListener("click", close);
  overlay.querySelector(".install-dialog-done").addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.body.append(overlay);
  overlay.querySelector(".install-dialog-close").focus();
}

export function registerServiceWorker(href) {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(href).catch(() => {});
  });
}
