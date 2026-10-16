// Prints the first pixel row of the page (the Shopify admin's black top bar) in a window capture.
import { PNG } from "pngjs"; import fs from "node:fs";
const p = PNG.sync.read(fs.readFileSync(process.argv[2]));
const x = 300;
const dark = (y) => { const i = (p.width * y + x) * 4; return p.data[i] < 20 && p.data[i+1] < 20 && p.data[i+2] < 20; };
for (let y = 150; y < 500; y++) if (dark(y) && dark(y + 20) && dark(y + 40)) { console.log(y); process.exit(0); }
console.log("none");
