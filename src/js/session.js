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
