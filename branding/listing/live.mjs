// Widget crops that need a click or a lookup first (the Track result, the Returns options, the open rewards panel),
// taken from the live demos by scripts/listing/capture-live.mjs. Each shot: the demo page, the steps (run in the
// page, in order, with a pause after each), and the element to crop (with some room around it).
const q = JSON.stringify;
const fill = (sel, v) => `(()=>{const e=document.querySelector(${q(sel)});e.focus();e.value=${q(v)};e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}))})()`;
const click = (sel) => `document.querySelector(${q(sel)}).click()`;
const lookup = (order) => [fill('input[name="order"]', order), fill('input[name="email"]', "alex@example.com"), click('.ucs-op__form button[type="submit"]')];

export const SHOTS = [
  // On its way: status, timeline, prices, the next order code and buy again.
  { name: "track", demo: "track", steps: lookup("1042"), crop: ".ucs-op__card", pad: 0, maxHeight: 1500 },
  // Delivered: "How was your order?", a review link, a returns link and a code to share with a friend.
  { name: "track-delivered", demo: "track", steps: lookup("1043"), crop: ".ucs-op__card", pad: 0, maxHeight: 1500 },
  // Returns with store credit and its bonus first, refund and exchange.
  { name: "returns", demo: "return-saving", steps: [...lookup("1042"), click('input[name="item"]')], crop: ".ucs-op__card", pad: 0, maxHeight: 1500 },
  // The rewards panel as a shopper opens it.
  { name: "loyalty", demo: "loyalty", steps: [click(".ucs-loy__launch")], crop: ".ucs-loy__panel", pad: 0, maxHeight: 1200 },
];
