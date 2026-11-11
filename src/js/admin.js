import { el, clear } from "./dom.js";
import { adminSummary, currentCatalog, onSync, refreshCatalog, saveRoute, setRouteActive, slugify, startSync, supabaseClient } from "./sync.js";

const routePaintVersion = new WeakMap();

export async function mountAdmin(root) {
  const client = supabaseClient();
  await startSync();
  if (!client) {
    root.append(el("section", { class: "card admin-card" }, [
      el("h1", { text: "Association dashboard" }),
      el("p", { text: "Supabase is not configured on this build, so sign-in cannot start." })
    ]));
    return;
  }
  const { data } = await client.auth.getSession();
  if (!isAdmin(data.session)) {
    renderLogin(root, client);
    return;
  }
  renderDashboard(root, client);
}

function isAdmin(session) {
  return session?.user?.app_metadata?.role === "admin";
}

function renderLogin(root, client) {
  const message = el("p", { class: "form-error", hidden: true });
  const email = el("input", { type: "email", required: "true", autocomplete: "username", placeholder: "admin@nako.bw", "aria-label": "Email" });
  const password = el("input", { type: "password", required: "true", autocomplete: "current-password", "aria-label": "Password" });
  const passwordToggle = el("button", { type: "button", class: "password-toggle", "aria-pressed": "false", text: "Show" });
  const passwordInput = el("div", { class: "password-input-wrap" }, [password, passwordToggle]);
  passwordToggle.addEventListener("click", () => {
    const showing = password.type === "text";
    password.type = showing ? "password" : "text";
    passwordToggle.textContent = showing ? "Show" : "Hide";
    passwordToggle.setAttribute("aria-pressed", showing ? "false" : "true");
    password.focus();
  });
  const form = el("form", { class: "stack" }, [
    el("label", { class: "field-label" }, [el("span", { text: "Work email" }), email]),
    el("label", { class: "field-label" }, [el("span", { text: "Password" }), passwordInput]),
    message,
    el("button", { class: "find", type: "submit", text: "Enter dashboard" })
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    const { data, error } = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (error || !isAdmin(data.session)) {
      if (data.session && !isAdmin(data.session)) await client.auth.signOut();
      message.hidden = false;
      message.textContent = "Those details were not accepted.";
      return;
    }
    clear(root);
    renderDashboard(root, client);
  });
  root.append(el("section", { class: "card admin-card admin-login-card" }, [
    brand(),
    el("h1", { text: "Association dashboard" }),
    el("p", { class: "lede", text: "Staff only. Passengers do not create accounts in this phase. This desk shows anonymous usage and the routes published to the finder." }),
    form
  ]));
}

function brand() {
  const mark = el("img", { class: "brand-mark", src: "../assets/icons/nako-logo.png?v=10", alt: "", width: "48", height: "36" });
  return el("div", { class: "brand" }, [
    mark,
    el("span", { class: "brand-name", text: "NakoLive" }),
    el("span", { class: "brand-sub", text: "Transport network" })
  ]);
}

function renderDashboard(root, client) {
  const stats = el("div", { class: "stat-grid" });
  const chart = el("div", { class: "chart" });
  const cities = el("div", { class: "panel" });
  const recent = el("div", { class: "panel" });
  const mix = el("div", { class: "panel" });
  const routesPanel = el("div", { class: "panel wide" });
  const applicationsPanel = el("div", { class: "panel wide" });
  let applicationsMounted = false;
  const notice = el("p", { class: "hint", text: "Loading usage…" });
  const liveState = el("span", { class: "live-dot", text: "Live" });
  const pageTitle = el("h1", { text: "Overview" });
  const pageCopy = el("p", { text: "A simple view of usage across the NakoLive network." });
  const overviewView = el("section", { class: "admin-view", "data-view": "overview" }, [
    stats,
    el("div", { class: "admin-split" }, [el("section", { class: "panel" }, [el("h2", { text: "Searches · last 14 days" }), chart]), mix]),
    el("div", { class: "admin-split" }, [cities, recent])
  ]);
  const driversView = el("section", { class: "admin-view", "data-view": "drivers", hidden: true }, [applicationsPanel]);
  const routesView = el("section", { class: "admin-view", "data-view": "routes", hidden: true }, [routesPanel]);
  const nav = el("nav", { class: "admin-nav", "aria-label": "Admin sections" });
  const sections = {
    overview: { label: "Overview", copy: "A simple view of usage across the NakoLive network.", icon: "01" },
    drivers: { label: "Driver approvals", copy: "Review taxi, kombi and bus applications in separate queues.", icon: "02" },
    routes: { label: "Route management", copy: "Publish and maintain the routes passengers can select.", icon: "03" }
  };

  function setView(view) {
    for (const panel of [overviewView, driversView, routesView]) panel.hidden = panel.dataset.view !== view;
    for (const button of nav.children) {
      const active = button.dataset.view === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    }
    pageTitle.textContent = sections[view].label;
    pageCopy.textContent = sections[view].copy;
  }

  for (const [view, section] of Object.entries(sections)) {
    nav.append(el("button", { type: "button", class: `admin-nav-button${view === "overview" ? " is-active" : ""}`, "data-view": view, onclick: () => setView(view) }, [
      el("span", { text: section.icon }), el("strong", { text: section.label })
    ]));
  }
  root.append(el("div", { class: "admin-shell" }, [
    el("aside", { class: "admin-side" }, [
      el("div", {}, [brand(), el("span", { class: "admin-portal-label", text: "ADMIN PORTAL" })]),
      nav,
      el("div", { class: "admin-side-foot" }, [
        el("p", { text: "Secure staff access" }),
        el("button", { type: "button", class: "ghost", onclick: async () => { await client.auth.signOut(); location.reload(); } }, ["Sign out"])
      ])
    ]),
    el("main", { class: "admin-main" }, [
      el("header", { class: "admin-head" }, [
        el("div", {}, [pageTitle, pageCopy]),
        el("div", { class: "admin-live-status" }, [liveState, notice])
      ]),
      overviewView,
      driversView,
      routesView
    ])
  ]));

  async function load() {
    if (!applicationsMounted) {
      applicationsMounted = true;
      paintApplications(applicationsPanel, client);
    }
    try {
      const summary = await adminSummary();
      if (!summary || typeof summary !== "object") throw new Error("Supabase returned no usage summary.");
      paintSummary(summary, stats, chart, cities, recent, mix);
      liveState.textContent = "Live";
      liveState.classList.remove("is-error");
      notice.textContent = "Updated now";
    } catch (error) {
      liveState.textContent = "Unavailable";
      liveState.classList.add("is-error");
      notice.textContent = navigator.onLine ? "Could not load live usage" : "Offline";
      paintSummaryUnavailable(stats, chart, cities, recent, mix);
      console.warn(error);
    }
  }

  routesPanel.append(el("p", { class: "hint", text: "Loading routes…" }));
  paintRoutes(routesPanel, client);
  load();
  let routeRefreshTimer;
  onSync(() => {
    if (routesPanel.querySelector(".editor-form")) return;
    window.clearTimeout(routeRefreshTimer);
    routeRefreshTimer = window.setTimeout(() => paintRoutes(routesPanel, client), 180);
  });
  window.setInterval(() => { if (!document.hidden) load(); }, 30000);
}

function stat(label, value) {
  return el("article", { class: "stat" }, [el("span", { text: label }), el("strong", { text: String(value ?? 0) })]);
}

function paintSummaryUnavailable(stats, chart, cities, recent, mix) {
  clear(stats);
  stats.append(el("article", { class: "stat data-unavailable" }, [
    el("span", { text: "Live usage unavailable" }),
    el("strong", { text: "—" }),
    el("p", { class: "hint", text: "No substitute or cached figures are being shown." })
  ]));
  clear(chart);
  chart.append(el("p", { class: "hint", text: "Search activity will return when the live Supabase connection is available." }));
  for (const [panel, title] of [[cities, "Towns people search"], [recent, "Recent activity"], [mix, "Transport searches · 30 days"]]) {
    clear(panel);
    panel.append(el("h2", { text: title }), el("p", { class: "hint", text: "Live data unavailable." }));
  }
}

function paintSummary(summary, stats, chart, cities, recent, mix) {
  clear(stats);
  stats.append(
    stat("Unique app sessions", summary.sessions_total),
    stat("Sessions today", summary.sessions_today),
    stat("Searches today", summary.searches_today),
    stat("Searches, 7 days", summary.searches_7d),
    stat("App opens today", summary.opens_today),
    stat("Install clicks, 7 days", summary.install_clicks_7d),
    stat("Installed-app sessions", summary.pwa_sessions)
  );
  clear(chart);
  const days = summary.by_day || [];
  const max = Math.max(1, ...days.map((day) => Number(day.searches) || 0));
  if (!days.length) chart.append(el("p", { class: "hint", text: "No searches in the last 14 days yet." }));
  for (const day of days) {
    const searches = Number(day.searches) || 0;
    chart.append(el("div", { class: "bar" }, [
      el("span", { style: `height:${Math.max(6, (searches / max) * 120)}px` }),
      el("small", { text: String(day.day).slice(5) }),
      el("em", { text: String(searches) })
    ]));
  }
  clear(cities);
  cities.append(el("h2", { text: "Towns people search" }));
  const topCities = summary.top_cities || [];
  if (!topCities.length) cities.append(el("p", { class: "hint", text: "No town searches yet." }));
  for (const city of topCities) cities.append(el("p", { class: "row" }, [el("strong", { text: city.city || "Unknown" }), el("span", { text: String(city.hits) })]));

  clear(recent);
  recent.append(el("h2", { text: "Recent activity" }));
  const events = summary.recent || [];
  if (!events.length) recent.append(el("p", { class: "hint", text: "Activity appears here as people use the app." }));
  for (const event of events) {
    recent.append(el("p", { class: "row" }, [
      el("strong", { text: String(event.event_name || "").replaceAll("_", " ") }),
      el("span", { text: [event.city, event.transport_type].filter(Boolean).join(" · ") || timeAgo(event.created_at) })
    ]));
  }

  clear(mix);
  mix.append(el("h2", { text: "Transport searches · 30 days" }));
  const transport = summary.transport_mix || {};
  for (const key of ["kombi", "taxi", "bus"]) {
    mix.append(el("p", { class: "row" }, [el("strong", { text: key }), el("span", { text: String(transport[key] || 0) })]));
  }
}

function timeAgo(value) {
  if (!value) return "";
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function manualRouteLabel(id) {
  return id.replace(/^manual:(?:(?:taxi|kombi|bus):)?/i, "");
}

function normalizeRouteName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function splitRouteNames(value) {
  return [...new Map(String(value || "").split(/[\n,;]+/)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((name) => [normalizeRouteName(name), name])).values()].slice(0, 12);
}

function paintApplications(panel, client) {
  clear(panel);
  let activeType = "taxi";
  const catalog = currentCatalog();
  const routeNames = new Map(catalog.places.flatMap((place) => place.routes.map((route) => [route.id, `${place.name} — ${route.name}`])));
  const tabs = el("div", { class: "admin-tabs", role: "tablist" });
  const list = el("div", { class: "application-list" });
  panel.append(
    el("div", { class: "step-row" }, [el("h2", { text: "Driver verification" }), el("span", { class: "live-dot", text: "Live" })]),
    el("p", { class: "hint", text: "Review driver and vehicle information. Approved drivers can share location; rejected drivers receive your message and can correct their application." }),
    tabs,
    list
  );
  for (const type of ["taxi", "kombi", "bus"]) {
    tabs.append(el("button", {
      type: "button", role: "tab", class: `admin-tab${type === activeType ? " is-active" : ""}`,
      text: `${type[0].toUpperCase() + type.slice(1)} drivers`, onclick: () => {
        activeType = type;
        for (const button of tabs.children) button.classList.toggle("is-active", button.textContent.toLowerCase().startsWith(type));
        load();
      }
    }));
  }

  async function load() {
    clear(list);
    list.append(el("p", { class: "hint", text: "Loading applications…" }));
    const { data, error } = await client.from("driver_profiles")
      .select("user_id,full_name,phone,transport_type,vehicle_description,plate,route_ids,status,rejection_message,warning_message,warned_at,banned_at,created_at")
      .eq("transport_type", activeType)
      .order("created_at", { ascending: false });
    clear(list);
    if (error) { list.append(el("p", { class: "form-error", text: "Applications will appear after the new Supabase schema is applied." })); return; }
    const rows = data || [];
    if (!rows.length) { list.append(el("p", { class: "hint", text: `No ${activeType} applications yet.` })); return; }
    for (const profile of rows) list.append(applicationCard(profile));
  }

  function applicationCard(profile) {
    const routes = (profile.route_ids || []).map((id) => ({
      id,
      name: id.startsWith("manual:") ? manualRouteLabel(id) : routeNames.get(id) || id,
      manual: id.startsWith("manual:")
    }));
    const approved = profile.status === "approved";
    const banned = profile.status === "banned";
    const message = el("textarea", {
      placeholder: approved ? "Type the warning or reason for a ban" : "Reason and what the driver must correct",
      "aria-label": approved ? "Driver moderation message" : "Rejection reason"
    });
    const feedback = el("p", { class: "hint", hidden: true });
    const routeEditor = el("div", { class: "admin-driver-route-editor", hidden: true });
    async function review(status) {
      if (status === "rejected" && !message.value.trim()) { feedback.textContent = "Type a clear rejection reason first."; feedback.hidden = false; return; }
      feedback.textContent = "Saving…";
      feedback.hidden = false;
      const { error } = await client.rpc("review_driver", { p_driver_id: profile.user_id, p_status: status, p_message: message.value.trim() || null });
      feedback.textContent = error ? "The decision could not be saved." : status === "approved" ? "Driver approved." : "Correction message sent.";
      if (!error) window.setTimeout(load, 450);
    }
    async function moderate(action) {
      const text = message.value.trim();
      if ((action === "warn" || action === "ban") && !text) {
        feedback.textContent = `Type a clear ${action === "warn" ? "warning" : "ban reason"} first.`;
        feedback.hidden = false;
        message.focus();
        return;
      }
      if (action === "delete" && !window.confirm(`Permanently delete ${profile.full_name}'s account? This removes their login, driver profile, saved draft, vehicle and live location from the database.`)) return;
      if (action === "ban" && !window.confirm(`Ban ${profile.full_name}? Their live location will be switched off immediately.`)) return;
      feedback.textContent = action === "delete" ? "Deleting driver…" : "Saving…";
      feedback.hidden = false;
      const { error } = await client.rpc("moderate_driver", { p_driver_id: profile.user_id, p_action: action, p_message: text || null });
      feedback.textContent = error
        ? "The moderation action could not be saved."
        : action === "warn" ? "Warning sent to the driver."
          : action === "ban" ? "Driver banned and location sharing stopped."
            : "Driver account and database records deleted.";
      if (!error) window.setTimeout(load, 450);
    }
    async function removeDriverRoute(route) {
      if (!window.confirm(`Remove “${route.name}” from ${profile.full_name}? Passengers will no longer see this route for the driver.`)) return;
      feedback.textContent = "Removing route…";
      feedback.hidden = false;
      const { error } = await client.rpc("admin_remove_driver_route", { p_driver_id: profile.user_id, p_route_id: route.id });
      feedback.textContent = error ? "The route could not be removed." : "Route removed from the driver.";
      if (!error) window.setTimeout(load, 350);
    }
    function openRouteEditor() {
      clear(routeEditor);
      routeEditor.hidden = false;
      const catalogNow = currentCatalog();
      const options = catalogNow.places
        .flatMap((place) => place.routes.map((route) => ({ ...route, placeName: place.name })))
        .filter((route) => route.transport_type === profile.transport_type);
      const selected = new Set(profile.route_ids || []);
      const choices = el("div", { class: "route-checkbox-list" });
      for (const route of options) {
        choices.append(el("label", { class: "route-checkbox" }, [
          el("input", { type: "checkbox", value: route.id, checked: selected.has(route.id) }),
          el("span", {}, [el("strong", { text: route.name }), el("small", { text: route.placeName })])
        ]));
      }
      if (!options.length) choices.append(el("p", { class: "hint", text: `No shared ${profile.transport_type} routes exist yet.` }));
      const manual = el("textarea", { rows: "3", maxlength: "900", placeholder: "One new route per line", "aria-label": "New route names" });
      const editorFeedback = el("p", { class: "hint", hidden: true, role: "status" });
      const save = el("button", { type: "submit", class: "find compact", text: "Save driver routes" });
      const form = el("form", { class: "stack" }, [
        el("div", { class: "form-section-head" }, [el("strong", { text: "Edit driver routes" }), el("span", { text: profile.transport_type })]),
        el("p", { class: "hint", text: "Tick shared routes, untick routes to remove them, or enter a new route name below." }),
        choices,
        el("label", { class: "field-label" }, [el("span", { text: "Add new routes — one per line" }), manual]),
        editorFeedback,
        el("div", { class: "row-actions" }, [
          save,
          el("button", { type: "button", class: "ghost", onclick: () => { routeEditor.hidden = true; } }, ["Cancel"])
        ])
      ]);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const routeIds = new Set([...choices.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value));
        const existingByName = new Map(options.map((route) => [normalizeRouteName(route.name), route.id]));
        for (const name of splitRouteNames(manual.value)) {
          routeIds.add(existingByName.get(normalizeRouteName(name)) || `manual:${profile.transport_type}:${name}`);
        }
        save.disabled = true;
        save.textContent = "Saving…";
        editorFeedback.hidden = false;
        editorFeedback.textContent = "Updating the driver profile…";
        const { data, error } = await client.rpc("admin_update_driver_routes", {
          p_driver_id: profile.user_id,
          p_route_ids: [...routeIds]
        });
        save.disabled = false;
        save.textContent = "Save driver routes";
        if (error) {
          editorFeedback.textContent = "The routes could not be updated. Please try again.";
          return;
        }
        profile.route_ids = data?.route_ids || [...routeIds];
        editorFeedback.textContent = "Driver routes updated.";
        window.setTimeout(load, 300);
      });
      routeEditor.append(form);
    }
    const actions = approved
      ? [
          el("button", { type: "button", class: "ghost moderation-warn", onclick: () => moderate("warn") }, ["Warn driver"]),
          el("button", { type: "button", class: "ghost moderation-ban", onclick: () => moderate("ban") }, ["Ban driver"]),
          el("button", { type: "button", class: "ghost moderation-delete", onclick: () => moderate("delete") }, ["Delete driver"])
        ]
      : banned
        ? [
            el("button", { type: "button", class: "find compact", onclick: () => review("approved") }, ["Restore driver"]),
            el("button", { type: "button", class: "ghost moderation-delete", onclick: () => moderate("delete") }, ["Delete driver"])
          ]
        : [
            el("button", { type: "button", class: "find compact", onclick: () => review("approved") }, ["Approve"]),
            el("button", { type: "button", class: "ghost", onclick: () => review("rejected") }, ["Request changes"])
          ];
    return el("article", { class: `application-card status-${profile.status}` }, [
      el("div", { class: "application-head" }, [
        el("div", {}, [el("strong", { text: profile.full_name }), el("span", { text: `${profile.vehicle_description} · ${profile.plate}` })]),
        el("span", { class: "status-pill", text: profile.status })
      ]),
      el("p", { class: "application-phone", text: profile.phone }),
      el("div", { class: "application-routes" }, [
        el("div", { class: "application-routes-head" }, [
          el("strong", { text: `Routes (${routes.length})` }),
          el("button", { type: "button", class: "ghost edit-driver-routes", onclick: openRouteEditor }, ["Edit routes"])
        ]),
        el("div", { class: "application-route-chips" }, routes.length
          ? routes.map((route) => el("span", { class: route.manual ? "is-manual" : "" }, [
              el("span", { text: route.manual ? `${route.name} · manual` : route.name }),
              el("button", { type: "button", class: "route-chip-delete", "aria-label": `Remove ${route.name} from ${profile.full_name}`, onclick: () => removeDriverRoute(route) }, ["×"])
            ]))
          : [el("span", { text: "No routes supplied" })])
      ]),
      routeEditor,
      approved && profile.warning_message ? el("div", { class: "moderation-note" }, [
        el("strong", { text: "Current warning" }), el("p", { text: profile.warning_message })
      ]) : null,
      banned ? el("div", { class: "moderation-note is-banned" }, [
        el("strong", { text: "Driver banned" }), el("p", { text: profile.rejection_message || "Location sharing is disabled." })
      ]) : null,
      banned ? null : message,
      el("div", { class: "row-actions moderation-actions" }, actions),
      feedback
    ]);
  }

  load();
  client.channel("admin-driver-applications")
    .on("postgres_changes", { event: "*", schema: "public", table: "driver_profiles" }, load)
    .subscribe();
}

async function loadAllRoutes(client) {
  if (!navigator.onLine) {
    return currentCatalog().places.flatMap((place) => place.routes.map((route) => ({ ...route, place_name: place.name, active: true })));
  }
  const { data, error } = await client.from("routes").select("id,place_id,zone_id,name,transport_type,origin_name,destination_name,summary,path,guide,active,places(name)").order("name");
  if (error) throw error;
  return (data || []).map((route) => ({ ...route, place_name: route.places?.name || route.place_id }));
}

async function paintRoutes(panel, client) {
  const version = (routePaintVersion.get(panel) || 0) + 1;
  routePaintVersion.set(panel, version);
  let routes;
  try {
    routes = await loadAllRoutes(client);
  } catch {
    if (routePaintVersion.get(panel) !== version || panel.querySelector(".route-table")) return;
    clear(panel);
    panel.append(el("p", { class: "hint", text: "Routes could not be loaded. They remain saved for passengers who already synced." }));
    return;
  }
  if (routePaintVersion.get(panel) !== version) return;

  const list = el("div", { class: "route-table" });
  const editor = el("div", { class: "editor" });
  clear(panel);
  panel.append(
    el("div", { class: "step-row" }, [
      el("h2", { text: "Routes" }),
      el("button", { type: "button", class: "ghost", onclick: () => openEditor(editor, client, null, () => paintRoutes(panel, client)) }, ["Add route"])
    ]),
    el("p", { class: "hint", text: "Add a route using its name. NakoLive automatically organises the technical details." }),
    editor,
    list
  );
  if (!routes.length) {
    list.append(el("p", { class: "hint", text: "No routes yet." }));
    return;
  }
  for (const route of routes) {
    list.append(el("article", { class: "route-row" }, [
      el("div", {}, [
        el("strong", { text: route.name }),
        el("span", { text: `${route.place_name || ""} · ${route.transport_type}${route.active === false ? " · hidden" : ""}` })
      ]),
      el("div", { class: "row-actions" }, [
        el("button", { type: "button", class: "text-button", onclick: () => openEditor(editor, client, route, () => paintRoutes(panel, client)) }, ["Edit"]),
        el("button", { type: "button", class: "text-button muted", onclick: async () => { await setRouteActive(route.id, route.active === false); paintRoutes(panel, client); } }, [route.active === false ? "Publish" : "Hide"]),
        el("button", { type: "button", class: "text-button route-delete", onclick: async (event) => {
          if (!window.confirm(`Permanently delete “${route.name}”? It will also be removed from every driver using it.`)) return;
          event.currentTarget.disabled = true;
          const { error } = await client.rpc("admin_delete_route", { p_route_id: route.id });
          if (error) { window.alert("The route could not be deleted."); event.currentTarget.disabled = false; return; }
          await refreshCatalog();
          paintRoutes(panel, client);
        } }, ["Delete"])
      ])
    ]));
  }
}

function openEditor(host, _client, route, onDone) {
  clear(host);
  const catalog = currentCatalog();
  const name = el("input", { required: "true", minlength: "2", maxlength: "120", value: route?.name || "", placeholder: "Example: Gaborone to Mochudi", "aria-label": "Route name", autofocus: "true" });
  const type = el("select", { required: "true", "aria-label": "Transport type" }, [
    ["taxi", "Taxi"], ["kombi", "Kombi"], ["bus", "Bus"]
  ].map(([value, label]) => el("option", { value, text: label, selected: (route?.transport_type || "kombi") === value ? "selected" : null })));
  const message = el("p", { class: "form-error", hidden: true });
  const form = el("form", { class: "stack editor-form simple-route-editor" }, [
    el("h3", { text: route ? "Edit route" : "Add route" }),
    el("label", { class: "field-label" }, [el("span", { text: "Route name" }), name]),
    el("label", { class: "field-label" }, [el("span", { text: "Transport type" }), type]),
    message,
    el("div", { class: "location-actions" }, [
      el("button", { class: "find compact", type: "submit", text: route ? "Save route" : "Add route" }),
      el("button", { type: "button", class: "ghost", onclick: () => clear(host) }, ["Cancel"])
    ])
  ]);
  host.append(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    if (!form.reportValidity()) return;
    try {
      const saved = await persistSimpleRoute(route, name.value, type.value, catalog);
      if (saved.queued) message.textContent = "Saved on this phone. It will publish when you are back online.";
      else message.textContent = "";
      await refreshCatalog();
      onDone();
    } catch (error) {
      message.hidden = false;
      message.textContent = error.message || "The route could not be saved.";
    }
  });
  name.focus();
}

function inferRouteParts(name, catalog) {
  const clean = name.trim().replace(/\s+/g, " ");
  const place = catalog.places.find((item) => clean.toLowerCase().includes(item.name.toLowerCase()))
    || catalog.places.find((item) => item.name === "Gaborone")
    || catalog.places[0];
  if (!place) throw new Error("No active town is available for this route.");
  const parts = clean.split(/\s+(?:to|–|—|-)\s+/i);
  return {
    clean,
    place,
    origin: parts[0] || clean,
    destination: parts[1] || clean
  };
}

async function persistSimpleRoute(route, value, type, catalog) {
  const { clean, place, origin, destination } = inferRouteParts(value, catalog);
  const path = Array.isArray(route?.path) && route.path.length >= 2
    ? route.path
    : [{ lat: Number(place.lat), lng: Number(place.lng) - 0.0002 }, { lat: Number(place.lat), lng: Number(place.lng) + 0.0002 }];
  return saveRoute({
    id: route?.id || `${place.id}-${type}-${slugify(clean)}-${crypto.randomUUID().slice(0, 4)}`,
    place_id: route?.place_id || place.id,
    zone_id: route?.zone_id || null,
    name: clean,
    transport_type: type,
    origin_name: route?.origin_name || origin,
    destination_name: route?.destination_name || destination,
    summary: route?.summary || "",
    path,
    guide: route?.guide ?? false,
    active: route?.active !== false
  });
}
