import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--use-gl=angle", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
page.on("pageerror", (error) => logs.push(`pageerror: ${error}`));
await page.setViewport({ width: 420, height: 900 });
await page.goto("http://127.0.0.1:4173/app/?preview=1", { waitUntil: "networkidle0" });
await page.waitForSelector("#app .find");
await page.evaluate(() => document.querySelector("#app .find").click());
await page.waitForSelector(".maplibregl-canvas");
await page.waitForFunction(() => document.querySelector(".veil")?.hidden === true, { timeout: 20000 });
await new Promise((resolve) => setTimeout(resolve, 2500));
const info = await page.evaluate(() => {
  const canvas = document.querySelector(".maplibregl-canvas");
  const rect = canvas.getBoundingClientRect();
  const sample = document.createElement("canvas");
  sample.width = canvas.width;
  sample.height = canvas.height;
  const ctx = sample.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  const data = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
  const corner = ctx.getImageData(20, 80, 1, 1).data;
  return {
    rect: { w: rect.width, h: rect.height, cw: canvas.width, ch: canvas.height },
    center: Array.from(data),
    corner: Array.from(corner),
    veil: document.querySelector(".veil")?.hidden,
    text: document.querySelector(".sheet")?.innerText?.slice(0, 240)
  };
});
console.log(JSON.stringify(info, null, 2));
console.log(logs.slice(0, 20).join("\n"));
await page.screenshot({ path: "C:\\Users\\Odyxsey\\develop\\Nako\\.secrets\\shots\\map-debug.png" });
await browser.close();
