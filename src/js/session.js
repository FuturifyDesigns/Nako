const SESSION_KEY = "nako_session";

export function sessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function platform() {
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** Phones and tablets only. Laptops and desktops stay on the information site. */
export function isHandheld() {
  const ua = navigator.userAgent || "";
  if (/iphone|ipod|android.+mobile/i.test(ua)) return true;
  if (/ipad|android(?!.+mobile)|tablet|kindle|silk/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  if (window.matchMedia("(max-width: 900px) and (pointer: coarse)").matches) return true;
  return false;
}
