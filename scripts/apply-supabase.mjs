import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = "zkykcxyqgaunpviwmxov";
if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: sql })
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`SQL failed ${response.status}: ${text.slice(0, 800)}`);
    process.exit(1);
  }
  return text;
}

const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, { headers });
const keysText = await keysResponse.text();
if (!keysResponse.ok) {
  console.error(`Keys failed ${keysResponse.status}`);
  process.exit(1);
}
const keys = JSON.parse(keysText);
const anon = keys.find((key) => key.name === "anon" || key.type === "anon" || key.id === "anon");
const service = keys.find((key) => key.name === "service_role" || key.type === "service_role");
const anonKey = anon?.api_key || anon?.apiKey;
const serviceKey = service?.api_key || service?.apiKey;
if (!anonKey || !serviceKey) {
  console.error(`Key names: ${keys.map((key) => key.name || key.id || key.type).join(", ")}`);
  process.exit(1);
}

const configPath = new URL("../src/js/config.js", import.meta.url);
let config = readFileSync(configPath, "utf8");
config = config.replace(/supabaseAnonKey: ".*"/, `supabaseAnonKey: ${JSON.stringify(anonKey)}`);
writeFileSync(configPath, config);
console.log(`anon key written, length ${anonKey.length}`);

console.log("applying schema");
await query(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
console.log("schema ok");
console.log("applying seed");
await query(readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
console.log("seed ok");

const counts = await query("select (select count(*) from public.places) as places, (select count(*) from public.routes) as routes, (select count(*) from public.zones) as zones;");
console.log(counts);

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json"
};
const existing = await fetch(`https://${ref}.supabase.co/auth/v1/admin/users?page=1&per_page=50`, { headers: authHeaders });
const existingText = await existing.text();
if (!existing.ok) {
  console.error(`User list failed ${existing.status}: ${existingText.slice(0, 300)}`);
  process.exit(1);
}
const users = JSON.parse(existingText).users || [];
const already = users.find((user) => user.email === "admin@nako.bw");
mkdirSync(new URL("../.secrets/", import.meta.url), { recursive: true });
if (already) {
  console.log("admin user already exists");
} else {
  const password = `Nako-${randomBytes(9).toString("base64url")}`;
  const created = await fetch(`https://${ref}.supabase.co/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email: "admin@nako.bw",
      password,
      email_confirm: true,
      app_metadata: { role: "admin" }
    })
  });
  const createdText = await created.text();
  if (!created.ok) {
    console.error(`Create admin failed ${created.status}: ${createdText.slice(0, 400)}`);
    process.exit(1);
  }
  writeFileSync(new URL("../.secrets/admin.txt", import.meta.url), `email=admin@nako.bw\npassword=${password}\n`);
  console.log("ADMIN_EMAIL=admin@nako.bw");
  console.log(`ADMIN_PASSWORD=${password}`);
}

const authConfig = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    disable_signup: true,
    site_url: "https://futurifydesigns.github.io/Nako/",
    uri_allow_list: "https://futurifydesigns.github.io/Nako/**"
  })
});
console.log(`auth config ${authConfig.status}`);
