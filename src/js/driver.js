import { config } from "./config.js";
import { clear, el } from "./dom.js";
import { isHandheld } from "./session.js";
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
    el("img", { class: "brand-mark", src: "../assets/icons/nako-logo.png?v=10", alt: "", width: "48", height: "36" }),
    el("span", { class: "brand-name", text: "NakoLive" }),
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
  if (!isHandheld()) {
    root.append(el("section", { class: "card admin-card driver-card driver-desktop-note" }, [
      brand(),
      el("p", { class: "eyebrow", text: "DRIVER REGISTRATION" }),
      el("h1", { text: "Use your phone to register" }),
      el("p", { class: "lede", text: "Driver registration and live location sharing are designed for phones. Open this same NakoLive website on your phone, then tap Register as a driver." }),
      el("a", { class: "find", href: "../", text: "Back to NakoLive" })
    ]));
    return;
  }
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
  const field = (label, input) => el("label", { class: "field-label auth-field" }, [el("span", { text: label }), input]);
  const mode = el("select", { "aria-label": "Account action" }, [
    el("option", { value: "login", text: "Sign in" }),
    el("option", { value: "register", text: "Create driver account" })
  ]);
  mode.value = new URLSearchParams(location.search).get("mode") === "register" ? "register" : "login";
  const email = el("input", { type: "email", required: "true", autocomplete: "email", placeholder: "driver@example.com", maxlength: "160" });
  const password = el("input", { type: "password", required: "true", minlength: "8", autocomplete: "current-password", placeholder: "Enter your password" });
  const strengthBars = el("div", { class: "strength-bars", "aria-hidden": "true" }, [0, 1, 2, 3, 4].map(() => el("span")));
  const strengthText = el("strong", { text: "Password strength" });
  const strength = el("div", { class: "password-strength", hidden: true, role: "status" }, [
    el("div", { class: "strength-row" }, [strengthText, el("span", { class: "strength-label", text: "" })]),
    strengthBars,
    el("small", { text: "Use 10+ characters with uppercase, lowercase, a number and a symbol." })
  ]);
  const message = el("p", { class: "form-error", hidden: true });
  const button = el("button", { class: "find", type: "submit", text: "Continue" });
  const privacyNote = el("p", { class: "privacy-hint" }, [
    "By creating an account, you acknowledge the ",
    el("a", { href: "../privacy/", text: "Privacy & data protection notice" }),
    "."
  ]);
  const form = el("form", { class: "stack auth-form" }, [field("What would you like to do?", mode), field("Email address", email), field("Password", password), strength, privacyNote, message, button]);

  function passwordScore(value) {
    if (!value) return 0;
    return [value.length >= 10, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value), value.length >= 14].filter(Boolean).length;
  }

  function updateStrength() {
    const registering = mode.value === "register";
    const score = passwordScore(password.value);
    strength.hidden = !registering || !password.value;
    strength.dataset.score = String(score);
    const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
    strength.querySelector(".strength-label").textContent = labels[score];
    password.setCustomValidity(registering && password.value && score < 4 ? "Use at least 10 characters with uppercase, lowercase, a number and a symbol." : "");
  }

  function updateMode() {
    const registering = mode.value === "register";
    button.textContent = registering ? "Create driver account" : "Sign in securely";
    password.autocomplete = registering ? "new-password" : "current-password";
    password.minLength = registering ? 10 : 8;
    password.placeholder = registering ? "Create a strong password" : "Enter your password";
    updateStrength();
  }

  mode.addEventListener("change", updateMode);
  password.addEventListener("input", updateStrength);
  for (const input of [email, password]) {
    input.addEventListener("blur", () => input.setAttribute("aria-invalid", input.checkValidity() ? "false" : "true"));
    input.addEventListener("input", () => input.setAttribute("aria-invalid", "false"));
  }
  updateMode();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateStrength();
    if (!form.reportValidity()) {
      message.textContent = "Please correct the highlighted fields before continuing.";
      message.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = mode.value === "register" ? "Creating account…" : "Signing in…";
    message.hidden = true;
    const credentials = mode.value === "register"
      ? {
          email: email.value.trim(),
          password: password.value,
          options: { emailRedirectTo: new URL("../auth/verified/", location.href).href }
        }
      : { email: email.value.trim(), password: password.value };
    const result = mode.value === "register" ? await db.auth.signUp(credentials) : await db.auth.signInWithPassword(credentials);
    button.disabled = false;
    updateMode();
    if (result.error) {
      message.textContent = result.error.message;
      message.hidden = false;
      return;
    }
    if (!result.data.session) {
      notify("Check your email and open the NakoLive verification link. You will then be returned to a page where you can continue to login.");
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
  const fullName = el("input", { required: "true", minlength: "2", maxlength: "100", value: existing?.full_name || "", autocomplete: "name", placeholder: "Your full name" });
  const phone = el("input", { required: "true", minlength: "7", maxlength: "30", pattern: "[+0-9() -]{7,30}", value: existing?.phone || "", type: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "+267 71 234 567" });
  const type = el("select", { required: "true" }, ["taxi", "kombi", "bus"].map((value) => el("option", { value, text: value[0].toUpperCase() + value.slice(1), selected: existing?.transport_type === value ? "selected" : null })));
  const vehicle = el("input", { required: "true", minlength: "2", maxlength: "120", value: existing?.vehicle_description || "", placeholder: "White Toyota Quantum" });
  const plate = el("input", { required: "true", minlength: "2", maxlength: "30", pattern: "[A-Za-z0-9 -]{2,30}", value: existing?.plate || "", autocapitalize: "characters", placeholder: "B 123 ABC" });
  const routes = el("select", { multiple: "true", required: "true", size: "7", "aria-label": "Routes" });
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
    field("Routes handled (hold Ctrl to select more than one)", routes),
    el("p", { class: "privacy-hint" }, ["See how we use and protect your information in our ", el("a", { href: "../privacy/", text: "Privacy Notice" }), "."]),
    message, submit
  ]);
  for (const input of [fullName, phone, type, vehicle, plate, routes]) {
    input.addEventListener("blur", () => input.setAttribute("aria-invalid", input.checkValidity() ? "false" : "true"));
    input.addEventListener("input", () => input.setAttribute("aria-invalid", "false"));
    input.addEventListener("change", () => input.setAttribute("aria-invalid", input.checkValidity() ? "false" : "true"));
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      message.textContent = "Please complete every required field and select at least one route.";
      message.hidden = false;
      return;
    }
    submit.disabled = true;
    submit.textContent = "Sending application…";
    message.hidden = true;
    const row = {
      user_id: user.id, full_name: fullName.value.trim(), phone: phone.value.trim(), transport_type: type.value,
      vehicle_description: vehicle.value.trim(),
      plate: plate.value.trim().toUpperCase(), route_ids: [...routes.selectedOptions].map((option) => option.value),
      status: "pending", rejection_message: null, reviewed_at: null, reviewed_by: null
    };
    const { error } = await db.from("driver_profiles").upsert(row);
    submit.disabled = false;
    submit.textContent = existing ? "Send corrected application" : "Send for verification";
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
  const consent = el("input", { type: "checkbox", id: "location-consent" });
  const consentLabel = el("label", { class: "location-consent", for: "location-consent" }, [
    consent,
    el("span", {}, [
      "I agree to share my precise live location with NakoLive passengers while sharing is switched on. I can switch it off at any time. ",
      el("a", { href: "../privacy/", text: "Privacy Notice" })
    ])
  ]);
  const button = el("button", { type: "button", class: "find", text: "Turn location on" });
  button.addEventListener("click", () => {
    if (watchId != null) {
      stopSharing(true, status, detail, button);
      return;
    }
    if (!consent.checked) {
      notify("Please agree to live location sharing before turning it on.", "error");
      consent.focus();
      return;
    }
    startSharing(status, detail, button);
  });
  shell("You are approved", [
    el("div", { class: "approval-pop" }, [el("strong", { text: "You can use NakoLive now" }), el("p", { text: "Turn on location only while you are operating. NakoLive sends moving updates in short intervals and slows down while idle to reduce data use." })]),
    el("div", { class: "status-panel approved" }, [el("strong", { text: `${profile.transport_type.toUpperCase()} · ${profile.vehicle_description}` }), el("p", { text: profile.plate })]),
    status, detail, consentLabel, button
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
