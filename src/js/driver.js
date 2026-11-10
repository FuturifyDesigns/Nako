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
let positionHistory = [];
let movingEvidence = 0;
let idleEvidence = 0;
let detectedMotionState = "idle";
let lastStrongMovementAt = 0;
let profileChannel = null;
const ROLE_CHOICE_KEY = "nakolive-role-choice-v1";
const SHARING_KEY = "nakolive-driver-sharing-v1";
const QUEUED_LOCATION_KEY = "nakolive-queued-driver-location-v1";

function manualRouteName(id) {
  if (!id?.startsWith("manual:")) return "";
  return id.replace(/^manual:(?:(?:taxi|kombi|bus):)?/i, "");
}

function manualRouteId(type, name) {
  return `manual:${type}:${name}`;
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("267") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 9) digits = digits.slice(1);
  if (digits.length === 8) return `+267${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function accountEmail(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (clean.includes("@")) return clean;
  const phone = normalizePhone(clean);
  return phone ? `${phone.slice(1)}@phone.nakolive.co.bw` : null;
}

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
  if (!data.session) renderAuth();
  else {
    localStorage.setItem(ROLE_CHOICE_KEY, "driver");
    renderDriver(data.session.user);
  }
}

function renderAuth() {
  clear(root);
  const field = (label, input) => el("label", { class: "field-label auth-field" }, [el("span", { text: label }), input]);
  const mode = el("select", { "aria-label": "Account action" }, [
    el("option", { value: "login", text: "Sign in" }),
    el("option", { value: "register", text: "Create driver account" })
  ]);
  mode.value = new URLSearchParams(location.search).get("mode") === "register" ? "register" : "login";
  const identifier = el("input", { type: "text", required: "true", autocomplete: "tel", inputmode: "tel", placeholder: "+267 71 234 567", maxlength: "160" });
  const identifierLabel = el("span", { text: "Phone number" });
  const password = el("input", { type: "password", required: "true", minlength: "8", autocomplete: "current-password", placeholder: "Enter your password" });
  const passwordToggle = el("button", { type: "button", class: "password-toggle", "aria-pressed": "false", text: "Show" });
  const passwordInput = el("div", { class: "password-input-wrap" }, [password, passwordToggle]);
  passwordToggle.addEventListener("click", () => {
    const showing = password.type === "text";
    password.type = showing ? "password" : "text";
    passwordToggle.textContent = showing ? "Show" : "Hide";
    passwordToggle.setAttribute("aria-pressed", showing ? "false" : "true");
    password.focus();
  });
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
  const identifierField = el("label", { class: "field-label auth-field" }, [identifierLabel, identifier]);
  const form = el("form", { class: "stack auth-form" }, [field("What would you like to do?", mode), identifierField, field("Password", passwordInput), strength, privacyNote, message, button]);

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
    identifierLabel.textContent = registering ? "Phone number" : "Phone number or existing email";
    identifier.placeholder = registering ? "+267 71 234 567" : "+267 71 234 567 or driver@example.com";
    identifier.inputMode = registering ? "tel" : "text";
    identifier.autocomplete = registering ? "tel" : "username";
    password.autocomplete = registering ? "new-password" : "current-password";
    password.minLength = registering ? 10 : 8;
    password.placeholder = registering ? "Create a strong password" : "Enter your password";
    updateStrength();
  }

  mode.addEventListener("change", updateMode);
  password.addEventListener("input", updateStrength);
  for (const input of [identifier, password]) {
    input.addEventListener("blur", () => input.setAttribute("aria-invalid", input.checkValidity() ? "false" : "true"));
    input.addEventListener("input", () => input.setAttribute("aria-invalid", "false"));
  }
  updateMode();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateStrength();
    const registering = mode.value === "register";
    const phone = normalizePhone(identifier.value);
    const loginEmail = accountEmail(identifier.value);
    identifier.setCustomValidity(!loginEmail || (registering && !phone) ? "Enter a valid phone number." : "");
    if (!form.reportValidity()) {
      message.textContent = "Please correct the highlighted fields before continuing.";
      message.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = mode.value === "register" ? "Creating account…" : "Signing in…";
    message.hidden = true;
    const credentials = registering
      ? {
          email: loginEmail,
          password: password.value,
          options: { data: { phone } }
        }
      : { email: loginEmail, password: password.value };
    const result = registering ? await db.auth.signUp(credentials) : await db.auth.signInWithPassword(credentials);
    button.disabled = false;
    updateMode();
    if (result.error) {
      message.textContent = result.error.message;
      message.hidden = false;
      return;
    }
    if (!result.data.session) {
      message.textContent = "The account was created, but instant sign-in is not enabled yet. Please contact the administrator.";
      message.hidden = false;
      mode.value = "login";
      updateMode();
      return;
    }
    localStorage.setItem(ROLE_CHOICE_KEY, "driver");
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
  clearProfileWatcher();
  clear(root);
  const profile = await profileFor(user.id);
  if (!profile || profile.status === "rejected") renderRegistration(user, profile);
  else if (profile.status === "pending") renderPending(user, profile);
  else if (profile.status === "banned") renderBanned(user, profile);
  else renderApproved(user, profile);
}

function shell(title, body, user) {
  clear(root);
  const passenger = el("a", {
    class: "driver-passenger-link",
    href: "../app/",
    onclick: () => localStorage.setItem(ROLE_CHOICE_KEY, "passenger")
  }, ["Passenger interface"]);
  const signOut = el("button", { type: "button", class: "driver-signout", onclick: async () => {
    await stopSharing(true);
    localStorage.setItem(ROLE_CHOICE_KEY, "passenger");
    await db.auth.signOut();
    renderAuth();
  } }, ["Sign out"]);
  root.append(el("section", { class: "card admin-card driver-card" }, [
    el("div", { class: "driver-shell-head" }, [brand(), el("div", { class: "driver-shell-actions" }, [passenger, signOut])]),
    el("h1", { text: title }), ...body
  ]));
}

function clearProfileWatcher() {
  if (profileChannel && db) db.removeChannel(profileChannel);
  profileChannel = null;
}

function watchProfile(user, onChange) {
  clearProfileWatcher();
  profileChannel = db.channel(`driver-profile-${user.id}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "driver_profiles", filter: `user_id=eq.${user.id}` }, onChange)
    .subscribe();
}

function renderPending(user, profile) {
  shell("Verification in progress", [
    el("div", { class: "status-panel pending" }, [el("strong", { text: `${profile.transport_type.toUpperCase()} · ${profile.plate}` }), el("p", { text: "Your information is waiting for an administrator to review it. This screen updates automatically." })]),
    el("p", { class: "hint", text: "You cannot share a live location until the application is approved." })
  ], user);
  watchProfile(user, () => renderDriver(user));
}

function renderBanned(user, profile) {
  shell("Driver access suspended", [
    el("div", { class: "status-panel rejected" }, [
      el("strong", { text: `${profile.transport_type.toUpperCase()} · ${profile.plate}` }),
      el("p", { text: profile.rejection_message || "Your driver access has been suspended by an administrator." })
    ]),
    el("p", { class: "hint", text: "Location sharing is disabled. Contact the transport administrator if you believe this is a mistake." })
  ], user);
  watchProfile(user, () => renderDriver(user));
}

function renderRegistration(user, existing) {
  const catalog = currentCatalog();
  const field = (label, input) => el("label", { class: "field-label" }, [el("span", { text: label }), input]);
  const fullName = el("input", { required: "true", minlength: "2", maxlength: "100", value: existing?.full_name || "", autocomplete: "name", placeholder: "Your full name" });
  const phone = el("input", { required: "true", minlength: "7", maxlength: "30", pattern: "[+0-9() -]{7,30}", value: existing?.phone || user.user_metadata?.phone || "", type: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "+267 71 234 567" });
  const type = el("select", { required: "true" }, ["taxi", "kombi", "bus"].map((value) => el("option", { value, text: `${value[0].toUpperCase() + value.slice(1)} driver`, selected: existing?.transport_type === value ? "selected" : null })));
  const vehicle = el("input", { required: "true", minlength: "2", maxlength: "120", value: existing?.vehicle_description || "", placeholder: "White Toyota Quantum" });
  const plate = el("input", { required: "true", minlength: "2", maxlength: "30", pattern: "[A-Za-z0-9 -]{2,30}", value: existing?.plate || "", autocapitalize: "characters", placeholder: "B 123 ABC" });
  const routeChoices = el("div", { class: "route-checkbox-list" });
  const routeCount = el("span", { class: "route-count", role: "status" });
  const existingOfficial = new Set((existing?.route_ids || []).filter((id) => !id.startsWith("manual:")));
  const existingManual = (existing?.route_ids || []).filter((id) => id.startsWith("manual:")).map(manualRouteName);
  const manualRoutes = el("textarea", { rows: "4", maxlength: "900", placeholder: "Example:\nMain Mall to Block 8\nStation to Tlokweng Border", "aria-label": "Other routes" });
  manualRoutes.value = existingManual.join("\n");

  function updateRouteCount() {
    const count = routeChoices.querySelectorAll('input[type="checkbox"]:checked').length;
    routeCount.textContent = `${count} selected`;
  }

  function fillRoutes(keepExisting = false) {
    const selected = keepExisting
      ? new Set([...routeChoices.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value))
      : existingOfficial;
    clear(routeChoices);
    const options = catalog.places.flatMap((place) => place.routes.map((route) => ({ ...route, placeName: place.name }))).filter((route) => route.transport_type === type.value);
    for (const route of options) {
      const checkbox = el("input", { type: "checkbox", value: route.id, checked: selected.has(route.id) });
      checkbox.addEventListener("change", updateRouteCount);
      routeChoices.append(el("label", { class: "route-checkbox" }, [
        checkbox,
        el("span", {}, [el("strong", { text: route.name }), el("small", { text: route.placeName })])
      ]));
    }
    if (!options.length) routeChoices.append(el("p", { class: "hint", text: `No published ${type.value} routes yet. Enter the routes manually below.` }));
    updateRouteCount();
  }
  type.addEventListener("change", () => fillRoutes(true));
  fillRoutes();
  const message = el("p", { class: "form-error", hidden: true });
  const submit = el("button", { class: "find", type: "submit", text: existing ? "Send corrected application" : "Send for verification" });
  const form = el("form", { class: "stack registration-form" }, [
    el("div", { class: "form-section" }, [
      el("div", { class: "form-section-head" }, [el("strong", { text: "Driver details" }), el("span", { text: "Required" })]),
      field("Driver name", fullName), field("Phone number", phone), field("Transport role", type)
    ]),
    el("div", { class: "form-section" }, [
      el("div", { class: "form-section-head" }, [el("strong", { text: "Vehicle details" }), el("span", { text: "Required" })]),
    el("div", { class: "form-grid" }, [field("Car or vehicle", vehicle), field("Plate number", plate)]),
    ]),
    el("fieldset", { class: "form-section route-picker" }, [
      el("legend", { text: "Routes handled" }),
      el("div", { class: "form-section-head route-picker-head" }, [el("p", { text: "Tick every published route you drive." }), routeCount]),
      routeChoices,
      field("Other routes — one per line (optional)", manualRoutes),
      el("p", { class: "hint", text: "You can select several checkboxes, enter several routes manually, or use both." })
    ]),
    el("p", { class: "privacy-hint" }, ["See how we use and protect your information in our ", el("a", { href: "../privacy/", text: "Privacy Notice" }), "."]),
    message, submit
  ]);
  for (const input of [fullName, phone, type, vehicle, plate, manualRoutes]) {
    input.addEventListener("blur", () => input.setAttribute("aria-invalid", input.checkValidity() ? "false" : "true"));
    input.addEventListener("input", () => input.setAttribute("aria-invalid", "false"));
    input.addEventListener("change", () => input.setAttribute("aria-invalid", input.checkValidity() ? "false" : "true"));
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const selectedRoutes = [...routeChoices.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    const typedRoutes = [...new Map(manualRoutes.value.split(/[\n,;]+/).map((route) => route.trim().replace(/\s+/g, " ")).filter(Boolean).map((route) => [route.toLowerCase(), route])).values()].slice(0, 12);
    if (!form.reportValidity() || (!selectedRoutes.length && !typedRoutes.length)) {
      message.textContent = !selectedRoutes.length && !typedRoutes.length
        ? "Select at least one route or enter a route manually."
        : "Please complete every required field.";
      message.hidden = false;
      return;
    }
    submit.disabled = true;
    submit.textContent = "Sending application…";
    message.hidden = true;
    const row = {
      user_id: user.id, full_name: fullName.value.trim(), phone: phone.value.trim(), transport_type: type.value,
      vehicle_description: vehicle.value.trim(),
      plate: plate.value.trim().toUpperCase(), route_ids: [...selectedRoutes, ...typedRoutes.map((route) => manualRouteId(type.value, route))],
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

function routeLabels(routeIds = []) {
  const official = new Map(currentCatalog().places.flatMap((place) => place.routes.map((route) => [route.id, `${place.name} — ${route.name}`])));
  return routeIds.map((id) => id.startsWith("manual:") ? manualRouteName(id) : official.get(id) || id);
}

function renderApproved(user, profile) {
  const roles = {
    taxi: { title: "Taxi driver console", kicker: "TAXI OPERATIONS", image: "taxi.png", copy: "Go visible when you are available so nearby passengers can find your taxi." },
    kombi: { title: "Kombi driver console", kicker: "KOMBI OPERATIONS", image: "kombi.png", copy: "Share your position while operating so passengers can see your kombi along its routes." },
    bus: { title: "Bus driver console", kicker: "BUS OPERATIONS", image: "bus.png", copy: "Share your position during service so passengers can see your bus and movement status." }
  };
  const role = roles[profile.transport_type] || roles.taxi;
  const status = el("strong", { class: "share-state", text: "Location is off" });
  const detail = el("p", { class: "hint", text: "Passengers cannot see this vehicle until you turn location on." });
  const consent = el("input", { type: "checkbox", id: "location-consent" });
  const shouldResumeSharing = localStorage.getItem(SHARING_KEY) === "true";
  consent.checked = shouldResumeSharing;
  const consentLabel = el("label", { class: "location-consent", for: "location-consent" }, [
    consent,
    el("span", {}, [
      "I agree to share my precise live location with NakoLive passengers while sharing is switched on. I can switch it off at any time. ",
      el("a", { href: "../privacy/", text: "Privacy Notice" })
    ])
  ]);
  const button = el("button", { type: "button", class: "find", text: "Turn location on" });
  const warning = el("div", { class: "status-panel driver-warning", hidden: true });
  function paintWarning(text) {
    clear(warning);
    warning.hidden = !text;
    if (text) warning.append(el("strong", { text: "Administrator warning" }), el("p", { text }));
  }
  paintWarning(profile.warning_message);
  const routeCount = el("span");
  const routeChips = el("div", { class: "driver-route-chips" });
  const routeEditor = el("section", { class: "form-section route-picker approved-route-editor", hidden: true });
  const manageRoutes = el("button", { type: "button", class: "ghost compact-route-action", text: "Change routes" });

  function paintAssignedRoutes() {
    const assignedRoutes = routeLabels(profile.route_ids);
    routeCount.textContent = `${assignedRoutes.length} total`;
    clear(routeChips);
    routeChips.append(...(assignedRoutes.length
      ? assignedRoutes.map((route) => el("span", { text: route }))
      : [el("p", { class: "hint", text: "No routes saved." })]));
  }

  function openRouteEditor() {
    clear(routeEditor);
    routeEditor.hidden = false;
    manageRoutes.hidden = true;
    const catalog = currentCatalog();
    const choices = el("div", { class: "route-checkbox-list" });
    const selectedOfficial = new Set((profile.route_ids || []).filter((id) => !id.startsWith("manual:")));
    const existingManual = (profile.route_ids || []).filter((id) => id.startsWith("manual:")).map(manualRouteName);
    const manual = el("textarea", { rows: "4", maxlength: "900", placeholder: "One route per line", "aria-label": "Other routes" });
    manual.value = existingManual.join("\n");
    const options = catalog.places
      .flatMap((place) => place.routes.map((route) => ({ ...route, placeName: place.name })))
      .filter((route) => route.transport_type === profile.transport_type);
    for (const route of options) {
      choices.append(el("label", { class: "route-checkbox" }, [
        el("input", { type: "checkbox", value: route.id, checked: selectedOfficial.has(route.id) }),
        el("span", {}, [el("strong", { text: route.name }), el("small", { text: route.placeName })])
      ]));
    }
    if (!options.length) choices.append(el("p", { class: "hint", text: "No published routes are available yet. Add route names below." }));
    const message = el("p", { class: "form-error", hidden: true });
    const save = el("button", { type: "submit", class: "find compact", text: "Save routes" });
    const form = el("form", { class: "stack" }, [
      el("div", { class: "form-section-head" }, [el("strong", { text: "Change your routes" }), el("span", { text: profile.transport_type })]),
      el("p", { class: "hint", text: "Select, remove or add every route you currently operate." }),
      choices,
      el("label", { class: "field-label" }, [el("span", { text: "Other routes — one per line" }), manual]),
      message,
      el("div", { class: "location-actions" }, [
        save,
        el("button", { type: "button", class: "ghost", onclick: () => { routeEditor.hidden = true; manageRoutes.hidden = false; } }, ["Cancel"])
      ])
    ]);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const official = [...choices.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
      const typed = [...new Map(manual.value.split(/[\n,;]+/).map((item) => item.trim().replace(/\s+/g, " ")).filter(Boolean).map((item) => [item.toLowerCase(), item])).values()].slice(0, 12);
      const routeIds = [...official, ...typed.map((item) => manualRouteId(profile.transport_type, item))];
      if (!routeIds.length) {
        message.textContent = "Select a route or enter at least one route name.";
        message.hidden = false;
        return;
      }
      save.disabled = true;
      save.textContent = "Saving…";
      const { error } = await db.rpc("update_driver_routes", { p_route_ids: routeIds });
      save.disabled = false;
      save.textContent = "Save routes";
      if (error) {
        message.textContent = "The routes could not be saved. Please try again.";
        message.hidden = false;
        return;
      }
      profile.route_ids = routeIds;
      paintAssignedRoutes();
      routeEditor.hidden = true;
      manageRoutes.hidden = false;
      notify("Your routes were updated.");
    });
    routeEditor.append(form);
  }

  manageRoutes.addEventListener("click", openRouteEditor);
  paintAssignedRoutes();
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
  shell(role.title, [
    el("section", { class: `driver-role-hero role-${profile.transport_type}` }, [
      el("div", {}, [el("p", { class: "driver-role-kicker", text: role.kicker }), el("strong", { text: profile.vehicle_description }), el("span", { text: profile.plate })]),
      el("img", { src: `../assets/vehicles/${role.image}`, alt: "", width: "150", height: "96" })
    ]),
    el("p", { class: "driver-role-copy", text: role.copy }),
    warning,
    el("div", { class: "approval-pop" }, [el("strong", { text: "Approved and ready" }), el("p", { text: "Turn on location only while you are operating. Your live position updates automatically." })]),
    el("section", { class: "driver-route-summary" }, [
      el("div", { class: "form-section-head" }, [el("strong", { text: "Your routes" }), routeCount]),
      routeChips,
      manageRoutes
    ]),
    routeEditor,
    el("section", { class: "driver-share-panel" }, [
      status, detail, consentLabel, button,
      el("p", { class: "background-location-note", text: "Location can keep updating while the PWA remains allowed to run in the background. Fully closing or force-stopping the app pauses GPS updates until NakoLive is opened again." })
    ])
  ], user);
  watchProfile(user, async (payload) => {
    const next = payload.new || {};
    if (payload.eventType === "DELETE" || next.status !== "approved") {
      await stopSharing(true);
      renderDriver(user);
      return;
    }
    if (next.warning_message !== profile.warning_message) {
      profile.warning_message = next.warning_message;
      paintWarning(profile.warning_message);
      if (profile.warning_message) notify("An administrator sent you a warning.", "error");
    }
  });
  if (shouldResumeSharing) window.setTimeout(() => startSharing(status, detail, button), 250);
}

function startSharing(status, detail, button) {
  if (!navigator.geolocation) { notify("Location is not available on this device.", "error"); return; }
  if (watchId != null) return;
  localStorage.setItem(SHARING_KEY, "true");
  button.disabled = true;
  detail.textContent = "Waiting for an accurate GPS position…";
  watchId = navigator.geolocation.watchPosition(async (position) => {
    const now = Date.now();
    if (position.coords.accuracy > 120) { detail.textContent = `Waiting for better accuracy (${Math.round(position.coords.accuracy)} m)…`; return; }
    lastPosition = position;
    const motion = classifyMotion(position);
    const elapsed = now - lastSentAt;
    if (lastSentPosition && motion === lastMotionState) {
      if (motion === "moving" && elapsed < (config.driverLocationIntervalMs || 3000)) return;
      if (motion === "idle" && elapsed < 10000) return;
    }
    lastSentAt = now;
    const locationPayload = {
      p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy,
      p_speed: position.coords.speed, p_heading: position.coords.heading, p_sampled_at: new Date(position.timestamp).toISOString(),
      p_motion_state: motion
    };
    localStorage.setItem(QUEUED_LOCATION_KEY, JSON.stringify(locationPayload));
    if (!navigator.onLine) {
      button.disabled = false;
      lastSentPosition = position;
      lastMotionState = motion;
      status.textContent = motion === "moving" ? "On the move" : "Idle";
      detail.textContent = "Offline · latest position saved and will sync when the connection returns.";
      button.textContent = "Turn location off";
      return;
    }
    let response = await db.rpc("publish_driver_location", locationPayload);
    // Keep location sharing operational during a staged deployment where the
    // database has not yet received the optional motion-state parameter.
    if (response.error?.code === "PGRST202") {
      const { p_motion_state, ...legacyPayload } = locationPayload;
      response = await db.rpc("publish_driver_location", legacyPayload);
    }
    const { data, error } = response;
    button.disabled = false;
    if (error) { detail.textContent = navigator.onLine ? "The location update failed. We will retry." : "Offline. The latest point will send when the connection returns."; return; }
    localStorage.removeItem(QUEUED_LOCATION_KEY);
    lastSentPosition = position;
    const publishedState = data?.motion_state || motion;
    lastMotionState = publishedState;
    status.textContent = publishedState === "moving" ? "On the move" : "Idle";
    detail.textContent = `Location on · accuracy about ${Math.round(position.coords.accuracy)} m · updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    button.textContent = "Turn location off";
  }, (error) => {
    button.disabled = false;
    if (error.code === 1) localStorage.setItem(SHARING_KEY, "false");
    detail.textContent = error.code === 1 ? "Allow precise location in your browser settings." : "Could not get a GPS position. Try again outdoors.";
    notify(detail.textContent, "error");
  }, { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 });
}

async function retryLatest() {
  if (watchId == null || localStorage.getItem(SHARING_KEY) !== "true") return;
  lastSentAt = 0;
  const raw = localStorage.getItem(QUEUED_LOCATION_KEY);
  if (!raw || !db) return;
  try {
    const payload = JSON.parse(raw);
    let response = await db.rpc("publish_driver_location", payload);
    if (response.error?.code === "PGRST202") {
      const { p_motion_state, ...legacyPayload } = payload;
      response = await db.rpc("publish_driver_location", legacyPayload);
    }
    if (!response.error) localStorage.removeItem(QUEUED_LOCATION_KEY);
  } catch {
    localStorage.removeItem(QUEUED_LOCATION_KEY);
  }
}

async function stopSharing(remote = true, status, detail, button) {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  lastPosition = null;
  lastSentPosition = null;
  lastMotionState = "idle";
  positionHistory = [];
  movingEvidence = 0;
  idleEvidence = 0;
  detectedMotionState = "idle";
  lastStrongMovementAt = 0;
  if (remote) localStorage.setItem(SHARING_KEY, "false");
  if (remote) localStorage.removeItem(QUEUED_LOCATION_KEY);
  if (remote && db) await db.rpc("stop_driver_location");
  if (status) status.textContent = "Location is off";
  if (detail) detail.textContent = "Passengers cannot see this vehicle until you turn location on.";
  if (button) { button.textContent = "Turn location on"; button.disabled = false; }
}

function classifyMotion(position) {
  const now = position.timestamp || Date.now();
  positionHistory.push(position);
  positionHistory = positionHistory.filter((item) => now - (item.timestamp || now) <= 12000).slice(-12);
  const reference = positionHistory.find((item) => now - (item.timestamp || now) >= 5000) || positionHistory[0];
  const seconds = Math.max(1, (now - (reference.timestamp || now)) / 1000);
  const traveled = reference === position ? 0 : distanceMeters(reference.coords, position.coords);
  const uncertainty = Math.max(18, Math.min(100, (Number(reference.coords.accuracy || 35) + Number(position.coords.accuracy || 35)) * 0.55));
  const reportedSpeed = Number.isFinite(position.coords.speed) && position.coords.speed >= 0 ? position.coords.speed : 0;
  const currentAccuracy = Number(position.coords.accuracy || 999);
  const calculatedSpeed = traveled / seconds;
  // Car movement is identified from driving-speed GPS readings or sustained
  // displacement. Ordinary hand movement and walking remain below this band.
  const reliableDrivingSpeed = reportedSpeed >= 2.4 && currentAccuracy <= 80;
  const distanceHasTravel = seconds >= 5 && traveled >= uncertainty && calculatedSpeed >= 2.1;
  const movingSignal = reliableDrivingSpeed || distanceHasTravel;

  if (movingSignal) {
    lastStrongMovementAt = now;
    movingEvidence += 1;
    idleEvidence = 0;
  } else {
    idleEvidence += 1;
    movingEvidence = 0;
  }
  if (detectedMotionState === "idle" && (reportedSpeed >= 4 || movingEvidence >= 2)) detectedMotionState = "moving";
  if (detectedMotionState === "moving" && now - lastStrongMovementAt >= 10000 && idleEvidence >= 4) detectedMotionState = "idle";
  return detectedMotionState;
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && watchId != null) lastSentAt = 0;
});
window.addEventListener("online", retryLatest);

function distanceMeters(a, b) {
  const lat = ((a.latitude + b.latitude) / 2) * Math.PI / 180;
  const x = (b.longitude - a.longitude) * Math.cos(lat) * 111320;
  const y = (b.latitude - a.latitude) * 111320;
  return Math.sqrt(x * x + y * y);
}

boot();
