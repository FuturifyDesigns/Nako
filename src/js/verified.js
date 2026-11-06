import { config } from "./config.js";

const title = document.querySelector("#verification-title");
const message = document.querySelector("#verification-message");
const loginLink = document.querySelector("#login-link");
const query = new URLSearchParams(location.search);
const hash = new URLSearchParams(location.hash.slice(1));
const error = query.get("error_description") || hash.get("error_description") || query.get("error") || hash.get("error");

if (error) {
  title.textContent = "Verification link could not be used";
  message.textContent = error.replaceAll("+", " ");
  loginLink.textContent = "Return and request a new link";
} else if (globalThis.supabase?.createClient && config.supabaseUrl && config.supabaseAnonKey) {
  const client = globalThis.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true }
  });
  try {
    const { data } = await client.auth.getSession();
    if (data.session) await client.auth.signOut({ scope: "local" });
  } catch (authError) {
    console.warn("Verification session cleanup was unavailable", authError);
  }
}

if (location.hash) history.replaceState(null, "", location.pathname + location.search);
