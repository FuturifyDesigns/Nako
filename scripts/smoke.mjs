import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const out = new URL("../.secrets/shots/", import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "new",
  args: ["--use-gl=angle", "--ignore-gpu-blocklist"]
});

const errors = [];
async function watch(page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
}

const page = await browser.newPage();
await watch(page);
await page.setViewport({ width: 1280, height: 800 });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle0", timeout: 30000 });
const home = await page.$eval("h1", (node) => node.textContent);
if (!home.includes("digital taxi-rank")) throw new Error(`unexpected home heading: ${home}`);
const shot = (name) => new URL(name, out).pathname.replace(/^\/([A-Za-z]:)/, "$1");
await page.screenshot({ path: shot("home.png") });

await page.goto("http://127.0.0.1:4173/app/", { waitUntil: "networkidle0" });
const gate = await page.$eval("#gate h1", (node) => node.textContent);
if (!gate.toLowerCase().includes("download")) throw new Error(`gate missing: ${gate}`);
await page.screenshot({ path: shot("gate.png") });

const phone = await browser.newPage();
await watch(phone);
await phone.setViewport({ width: 420, height: 900, isMobile: true, hasTouch: true });
await phone.goto("http://127.0.0.1:4173/app/?preview=1", { waitUntil: "networkidle0", timeout: 30000 });
await phone.waitForSelector(".type-card.is-selected", { timeout: 10000 });
const selected = await phone.$eval(".type-card.is-selected strong", (node) => node.textContent);
if (selected !== "Kombi") throw new Error(`default transport ${selected}`);
await phone.screenshot({ path: shot("form.png"), fullPage: true });
await phone.evaluate(() => {
  document.querySelector("#app .zone-card")?.click();
  document.querySelector("#app .find")?.click();
});
await phone.waitForSelector("#app .maplibregl-canvas", { timeout: 20000 });
await phone.waitForFunction(() => {
  const veil = document.querySelector(".veil");
  return veil && veil.hidden;
}, { timeout: 15000 });
await phone.waitForSelector(".vehicle", { timeout: 10000 });
const vehicleText = await phone.$eval(".vehicle", (node) => node.innerText);
if (!/Simulated/i.test(vehicleText)) throw new Error(vehicleText);
await new Promise((resolve) => setTimeout(resolve, 1500));
await phone.screenshot({ path: shot("finder.png") });

const admin = await browser.newPage();
await watch(admin);
await admin.setViewport({ width: 1280, height: 800 });
await admin.goto("http://127.0.0.1:4173/admin/", { waitUntil: "networkidle0" });
await admin.waitForSelector("input[type=password]", { timeout: 10000 });
await admin.type("input[type=email]", "admin@nako.bw");
await admin.type("input[type=password]", process.env.NAKO_ADMIN_PASSWORD);
await admin.click("button[type=submit]");
await admin.waitForSelector(".stat-grid", { timeout: 15000 });
const heading = await admin.$eval("h1", (node) => node.textContent);
if (heading !== "Overview") throw new Error(`admin heading ${heading}`);
await admin.screenshot({ path: shot("admin.png") });

console.log("SMOKE_OK");
if (errors.length) console.log(errors.slice(0, 12).join("\n---\n"));
await browser.close();
