import { config } from "./config.js";
import { clear, el } from "./dom.js";
import { currentCatalog, startSync, supabaseClient } from "./sync.js";

const root = document.querySelector("#driver");
const db = supabaseClient();
let watchId = null;
let lastSentAt = 0;
let lastPosition = null;
let lastSentPosition = null;
let lastMotionState = "idle";

function brand() {
  return el("a", { class: "brand", href: "../" }, [
    el("img", { class: "brand-mark", src: "../assets/icons/nako-logo.png", alt: "", width: "48", height: "36" }),
    el("span", { class: "brand-name", text: "Nako" }),
    el("span", { class: "brand-sub", text: "Transport network" })
  ]);
}

function notify(message, kind = "ok") {
  document.querySelector(".action-toast")?.remove();
  const toast = el("div", { class: `action-toast ${kind}`, role: "status", text: message });
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

async function profileFor(userId) {
  const { data } = await db.from("driver_profiles").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

async function boot() {
  if (!db) {
    root.append(el("section", { class: "card admin-card" }, [brand(), el("h1", { text: "Driver access" }), el("p", { text: "Driver access is not configured on this build." })]));
    return;
  }
  await startSync();
  const { data } = await db.auth.getSession();
  if (!data.session) renderAuth(); else renderDriver(data.session.user);
}

function renderAuth() {
  clear(root);
  const mode = el("select", { "aria-label": "Account action" }, [
    el("option", { value: "login", text: "Sign in" }),
    el("option", { value: "register", text: "Create driver account" })
  ]);
  const email = el("input", { type: "email", required: "true", autocomplete: "email", placeholder: "Email address" });
  const password = el("input", { type: "password", required: "true", minlength: "8", autocomplete: "current-password", placeholder: "Password" });
  const message = el("p", { class: "form-error", hidden: true });
  const button = el("button", { class: "find", type: "submit", text: "Continue" });
  const form = el("form", { class: "stack" }, [mode, email, password, message, button]);
  mode.addEventListener("change", () => {
    button.textContent = mode.value === "register" ? "Create account" : "Sign in";
    password.autocomplete = mode.value === "register" ? "new-password" : "current-password";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    message.hidden = true;
    const credentials = { email: email.value.trim(), password: password.value };
    const result = mode.value === "register" ? await db.auth.signUp(credentials) : await db.auth.signInWithPassword(credentials);
    button.disabled = false;
    if (result.error) {
      message.textContent = result.error.message;
      message.hidden = false;
      return;
    }
    if (!result.data.session) {
      notify("Check your email to confirm your account, then sign in.");
      mode.value = "login";
      button.textContent = "Sign in";
      return;
    }
    renderDriver(result.data.user);
  });
  root.append(el("section", { class: "card admin-card driver-card" }, [
    brand(), el("p", { class: "eyebrow", text: "DRIVER PORTAL" }),
    el("h1", { text: "Register and share your location" }),
    el("p", { class: "lede", text: "Approved taxi, kombi and bus drivers can appear on the passenger map while location sharing is on." }), form
  ]));
}

async function renderDriver(user) {
  stopSharing(false);
  clear(root);
  const profile = await profileFor(user.id);
  if (!profile || profile.status === "rejected") renderRegistration(user, profile);
  else if (profile.status === "pending") renderPending(user, profile);
  else renderApproved(user, profile);
}

function shell(title, body, user) {
  clear(root);
  root.append(el("section", { class: "card admin-card driver-card" }, [
    brand(), el("h1", { text: title }), ...body,
    el("button", { type: "button", class: "text-button muted", onclick: async () => { stopSharing(true); await db.auth.signOut(); renderAuth(); } }, ["Sign out"])
  ]));
}

function renderPending(user, profile) {
  shell("Verification in progress", [
    el("div", { class: "status-panel pending" }, [el("strong", { text: `${profile.transport_type.toUpperCase()} · ${profile.plate}` }), el("p", { text: "Your information is waiting for an administrator to review it. This screen updates automatically." })]),
    el("p", { class: "hint", text: "You cannot share a live location until the application is approved." })
  ], user);
  const channel = db.channel(`driver-approval-${user.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `user_id=eq.${user.id}` }, async () => {
    await db.removeChannel(channel);
    renderDriver(user);
  }).subscribe();
}

function renderRegistration(user, existing) {
  const catalog = currentCatalog();
  const field = (label, input) => el("label", { class: "field-label" }, [el("span", { text: label }), input]);
  const fullName = el("input", { required: "true", value: existing?.full_name || "", autocomplete: "name" });
  const phone = el("input", { required: "true", value: existing?.phone || "", type: "tel", autocomplete: "tel" });
  const type = el("select", { required: "true" }, ["taxi", "kombi", "bus"].map((value) => el("option", { value, text: value[0].toUpperCase() + value.slice(1), selected: existing?.transport_type === value ? "selected" : null })));
  const vehicle = el("input", { required: "true", value: existing?.vehicle_description || "", placeholder: "White Toyota Quantum" });
  const plate = el("input", { required: "true", value: existing?.plate || "", autocapitalize: "characters" });
  const routes = el("select", { multiple: "true", size: "7", "aria-label": "Routes" });
  function fillRoutes() {
    clear(routes);
    const options = catalog.places.flatMap((place) => place.routes.map((route) => ({ ...route, placeName: place.name }))).filter((route) => route.transport_type === type.value);
    for (const route of options) routes.append(el("option", { value: route.id, text: `${route.placeName} — ${route.name}`, selected: existing?.route_ids?.includes(route.id) ? "selected" : null }));
  }
  type.addEventListener("change", fillRoutes);
  fillRoutes();
  const message = el("p", { class: "form-error", hidden: true });
  const submit = el("button", { class: "find", type: "submit", text: existing ? "Send corrected application" : "Send for verification" });
  const form = el("form", { class: "stack registration-form" }, [
    field("Driver name", fullName), field("Phone number", phone), field("Transport role", type),
    el("div", { class: "form-grid" }, [field("Car or vehicle", vehicle), field("Plate number", plate)]),
    field("Routes handled (hold Ctrl to select more than one)", routes), message, submit
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.hidden = true;
    const row = {
      user_id: user.id, full_name: fullName.value.trim(), phone: phone.value.trim(), transport_type: type.value,
      vehicle_description: vehicle.value.trim(),
      plate: plate.value.trim().toUpperCase(), route_ids: [...routes.selectedOptions].map((option) => option.value),
      status: "pending", rejection_message: null, reviewed_at: null, reviewed_by: null
    };
    const { error } = await db.from("driver_profiles").upsert(row);
    submit.disabled = false;
    if (error) { message.textContent = error.message; message.hidden = false; return; }
    notify("Application sent for verification.");
    renderDriver(user);
  });
  const intro = [];
  if (existing?.rejection_message) intro.push(el("div", { class: "status-panel rejected" }, [el("strong", { text: "Changes required" }), el("p", { text: existing.rejection_message })]));
  intro.push(el("p", { class: "lede", text: "Enter your contact, vehicle and route information for the administrator to verify." }), form);
  shell(existing ? "Correct your application" : "Driver registration", intro, user);
}

function renderApproved(user, profile) {
  const status = el("strong", { class: "share-state", text: "Location is off" });
  const detail = el("p", { class: "hint", text: "Passengers cannot see this vehicle until you turn location on." });
  const button = el("button", { type: "button", class: "find", text: "Turn location on" });
  button.addEventListener("click", () => {
    if (watchId != null) stopSharing(true, status, detail, button); else startSharing(status, detail, button);
  });
  shell("You are approved", [
    el("div", { class: "approval-pop" }, [el("strong", { text: "You can use Nako now" }), el("p", { text: "Turn on location only while you are operating. Nako sends moving updates in short intervals and slows down while idle to reduce data use." })]),
    el("div", { class: "status-panel approved" }, [el("strong", { text: `${profile.transport_type.toUpperCase()} · ${profile.vehicle_description}` }), el("p", { text: profile.plate })]),
    status, detail, button
  ], user);
}

function startSharing(status, detail, button) {
  if (!navigator.geolocation) { notify("Location is not available on this device.", "error"); return; }
  button.disabled = true;
  detail.textContent = "Waiting for an accurate GPS position…";
  watchId = navigator.geolocation.watchPosition(async (position) => {
    const now = Date.now();
    if (position.coords.accuracy > 120) { detail.textContent = `Waiting for better accuracy (${Math.round(position.coords.accuracy)} m)…`; return; }
    lastPosition = position;
    const meters = lastSentPosition ? distanceMeters(lastSentPosition.coords, position.coords) : Infinity;
    const motion = (position.coords.speed || 0) >= 1.2 || meters >= 20 ? "moving" : "idle";
    const elapsed = now - lastSentAt;
    if (lastSentPosition && motion === lastMotionState) {
      if (motion === "moving" && elapsed < (config.driverLocationIntervalMs || 20000) && meters < 30) return;
      if (motion === "idle" && elapsed < 90000) return;
    }
    lastSentAt = now;
    const { data, error } = await db.rpc("publish_driver_location", {
      p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy,
      p_speed: position.coords.speed, p_heading: position.coords.heading, p_sampled_at: new Date(position.timestamp).toISOString()
    });
    button.disabled = false;
    if (error) { detail.textContent = navigator.onLine ? "The location update failed. We will retry." : "Offline. The latest point will send when the connection returns."; return; }
    lastSentPosition = position;
    lastMotionState = data?.motion_state || motion;
    status.textContent = data?.motion_state === "moving" ? "On the move" : "Idle";
    detail.textContent = `Location on · accuracy about ${Math.round(position.coords.accuracy)} m · updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    button.textContent = "Turn location off";
  }, (error) => {
    button.disabled = false;
    detail.textContent = error.code === 1 ? "Allow precise location in your browser settings." : "Could not get a GPS position. Try again outdoors.";
    notify(detail.textContent, "error");
  }, { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 });
  window.addEventListener("online", retryLatest, { once: true });
}

async function retryLatest() {
  if (!lastPosition || watchId == null) return;
  lastSentAt = 0;
}

async function stopSharing(remote = true, status, detail, button) {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  lastPosition = null;
  lastSentPosition = null;
  lastMotionState = "idle";
  if (remote && db) await db.rpc("stop_driver_location");
  if (status) status.textContent = "Location is off";
  if (detail) detail.textContent = "Passengers cannot see this vehicle until you turn location on.";
  if (button) { button.textContent = "Turn location on"; button.disabled = false; }
}

function distanceMeters(a, b) {
  const lat = ((a.latitude + b.latitude) / 2) * Math.PI / 180;
  const x = (b.longitude - a.longitude) * Math.cos(lat) * 111320;
  const y = (b.latitude - a.latitude) * 111320;
  return Math.sqrt(x * x + y * y);
}

boot();
