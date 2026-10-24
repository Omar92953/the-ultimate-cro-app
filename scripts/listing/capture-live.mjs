#!/usr/bin/env node
// Captures the widget crops in branding/listing/live.mjs: opens each demo in headless Chrome, runs its steps
// (a lookup, a click) and saves the element at 2x to branding/listing/widgets/<name>.png.
// Usage: node scripts/listing/capture-live.mjs [name ...]   (no names = all). Base URL: DEMO_URL (default https://crotoolbox.com/demo).
// Needs Google Chrome (CHROME to override) and Node 22 or newer (built in WebSocket).
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SHOTS } from "../../branding/listing/live.mjs";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = (process.env.DEMO_URL || "https://crotoolbox.com/demo").replace(/\/$/, "");
const only = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cro-capture-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--disable-gpu", "--window-size=1600,1100", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageSocket() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await pageSocket());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const waiting = new Map();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id;
  waiting.set(n, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
const run = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1100, deviceScaleFactor: 2, mobile: false });
  for (const s of SHOTS) {
    if (only.length && !only.includes(s.name)) continue;
    // The demo page shows each design in a frame: open the design page itself.
    await send("Page.navigate", { url: `${BASE}/${s.demo}/${s.page ?? "design-1.html"}` });
    for (let i = 0; i < 50 && (await run("document.readyState").catch(() => "")) !== "complete"; i++) await sleep(200);
    await sleep(1500);
    for (const step of s.steps) {
      await run(step);
      await sleep(1200);
    }
    // Pictures load lazily: wait until every image in the crop has loaded (at most 5 seconds).
    await run(`new Promise((done)=>{const e=document.querySelector(${JSON.stringify(s.crop)});const imgs=e?[...e.querySelectorAll("img")]:[];imgs.forEach((i)=>{i.loading="eager"});let n=0;const t=setInterval(()=>{if(imgs.every((i)=>i.complete&&i.naturalWidth)||++n>25){clearInterval(t);done(true)}},200)})`).catch(() => null);
    await sleep(800);
    const box = await run(`(()=>{const e=document.querySelector(${JSON.stringify(s.crop)});if(!e)return null;e.scrollIntoView({block:"start"});const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`);
    if (!box) throw new Error(`${s.name}: ${s.crop} not found`);
    const pad = s.pad ?? 0;
    const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.w + pad * 2, height: Math.min(box.h + pad * 2, s.maxHeight ?? 2000), scale: 1 };
    const shot = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
    const out = `branding/listing/widgets/${s.name}.png`;
    fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`✓ ${out} (${Math.round(clip.width)} x ${Math.round(clip.height)} CSS px)`);
  }
} finally {
  ws.close();
  chrome.kill();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Chrome may still hold its profile; it is a temp folder. */ }
}
