/**
 * Checkout features can't run outside Shopify, so their demos are faithful pictures of Shopify's
 * checkout, thank-you and after-purchase pages, with what CRO Toolbox changes marked. Texts follow
 * the app's own defaults (app/lib/checkout-rules.ts, thank-you.ts, post-purchase.ts).
 */
import { STORE_NAME } from "./shell.mjs";
import { imgUrl } from "./data.mjs";

const CSS = `<style>
.co{background:#fff;color:#1a1a1a;font:14px/1.5 -apple-system,"Segoe UI",Roboto,sans-serif}
.co__top{border-bottom:1px solid #e3e3e3;padding:18px 0}.co__top .page-width{display:flex;justify-content:space-between;align-items:center}
.co__brand{font-weight:800;font-size:20px;letter-spacing:-.02em}.co__bag{font-size:13px;color:#555}
.co__grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);min-height:560px}
@media (max-width:749px){.co__grid{grid-template-columns:minmax(0,1fr)}.co__side{order:-1}}
.co__main{padding:28px 32px 40px 0;max-width:600px;margin-left:auto;width:100%}
@media (max-width:749px){.co__main{padding:20px 0}}
.co__side{background:#f5f5f5;border-left:1px solid #e3e3e3;padding:28px 0 28px 32px}
@media (max-width:749px){.co__side{border-left:0;padding:16px}}
.co h2{font-size:18px;margin:22px 0 10px}
.co__field{border:1px solid #d9d9d9;border-radius:6px;padding:12px;color:#707070;margin-bottom:10px}
.co__opts{border:1px solid #d9d9d9;border-radius:8px;overflow:hidden}
.co__opt{display:flex;align-items:center;gap:10px;padding:14px;border-top:1px solid #e3e3e3;position:relative}
.co__opt:first-child{border-top:0}
.co__opt.is-on{background:#f0f5ff;box-shadow:inset 0 0 0 1px #1773b0;border-radius:8px}
.co__opt i{width:16px;height:16px;border-radius:50%;border:1.5px solid #8a8a8a;flex:none}
.co__opt.is-on i{border:5px solid #1773b0}
.co__opt span{flex:1}.co__opt b{font-weight:600}
.co__opt.is-gone{background:repeating-linear-gradient(-45deg,#fafafa,#fafafa 6px,#f1f1f1 6px,#f1f1f1 12px);color:#999;text-decoration:line-through}
.co__tag{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;background:#0b7a45;color:#fff;padding:2px 8px;border-radius:999px;text-decoration:none}
.co__tag--warn{background:#b42318}
.co__pay{margin-top:22px;width:100%;min-height:54px;border:0;border-radius:6px;background:#1773b0;color:#fff;font:inherit;font-weight:600;font-size:16px}
.co__err{background:#fff4f4;border:1px solid #f1b5b0;color:#8a1c12;border-radius:8px;padding:12px 14px;margin:6px 0 10px;display:flex;gap:10px}
.co__err b{display:block}
.co__line{display:flex;gap:12px;align-items:center;margin-bottom:12px}.co__line img{width:56px;height:56px;border-radius:8px;border:1px solid #e3e3e3;background:#fff}
.co__line span{flex:1}.co__line small{display:block;color:#707070}
.co__sum{display:flex;justify-content:space-between;margin:6px 0}.co__sum--total{font-size:18px;font-weight:700;margin-top:12px}
.co__sum--disc{color:#0b7a45}
.co__note{margin:18px 0 0;font-size:12px;color:#5a5c66;background:#fff;border:1px dashed #c9c9c3;border-radius:8px;padding:10px 12px}
.ty{max-width:600px}.ty__check{width:48px;height:48px;border-radius:50%;border:2px solid #1773b0;display:grid;place-items:center;color:#1773b0;font-size:24px}
.ty__card{border:1px solid #d9d9d9;border-radius:8px;padding:16px;margin-top:14px;position:relative}
.ty__card h3{margin:0 0 6px;font-size:15px}
.ty__code{display:flex;gap:8px;margin-top:10px}.ty__code code{flex:1;border:1px dashed #1773b0;border-radius:6px;padding:8px 12px;font:600 15px ui-monospace,monospace;color:#1773b0}
.ty__code button,.ty__btn{border:0;border-radius:6px;background:#1773b0;color:#fff;padding:8px 14px;font:inherit;font-weight:600}
.ty__social{display:flex;gap:8px;margin-top:10px}.ty__social span{border:1px solid #d9d9d9;border-radius:999px;padding:6px 14px;font-weight:600}
.ty__prods{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}.ty__prods img{border-radius:8px;aspect-ratio:1}
.ty__prods small{display:block;font-weight:600;margin-top:4px}
.ty__mark{position:absolute;top:-10px;right:12px;font-size:11px;font-weight:700;background:#0b7a45;color:#fff;padding:2px 8px;border-radius:999px}
.pp{max-width:720px;margin:0 auto;padding:28px 20px 48px;text-align:center}
.pp__box{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;text-align:left;margin-top:22px;border:1px solid #d9d9d9;border-radius:12px;padding:20px}
@media (max-width:640px){.pp__box{grid-template-columns:minmax(0,1fr)}}
.pp__box img{border-radius:10px}.pp__price{font-size:20px;font-weight:700}.pp__price s{color:#707070;font-weight:400;font-size:15px;margin-left:6px}
.pp__save{display:inline-block;background:#e3f8ec;color:#0b7a45;font-weight:700;font-size:12px;padding:2px 8px;border-radius:999px;margin-left:6px}
.pp__accept{display:block;width:100%;min-height:50px;border:0;border-radius:6px;background:#1773b0;color:#fff;font:inherit;font-weight:600;margin-top:14px}
.pp__decline{display:block;width:100%;min-height:44px;border:0;background:none;color:#1773b0;font:inherit;margin-top:6px;text-decoration:underline}
</style>`;

const img = (h) => imgUrl(h);
const top = (label = "") => `<div class="co__top"><div class="page-width"><span class="co__brand">${STORE_NAME}</span><span class="co__bag">${label}</span></div></div>`;
const LINES = [
  ["glow-serum", "Glow Serum", "30 ml", 1, 34],
  ["cedar-candle", "Cedar Candle", "", 2, 22],
  ["clay-mug", "Clay Mug", "", 1, 18],
];
function summary({ lines = LINES, discount = 0, shipping = "Free" } = {}) {
  const sub = lines.reduce((t, l) => t + l[3] * l[4], 0);
  return `<aside class="co__side"><div style="max-width:420px">${lines
    .map(([h, t, v, q, p]) => `<div class="co__line"><img src="${img(h)}" alt=""><span>${t}${v ? `<small>${v}</small>` : ""}<small>Qty ${q}</small></span><b>$${(q * p).toFixed(2)}</b></div>`)
    .join("")}<div class="co__sum"><span>Subtotal</span><span>$${sub.toFixed(2)}</span></div>${
    discount ? `<div class="co__sum co__sum--disc"><span>Bundle and offer discounts</span><span>You save $${discount.toFixed(2)}</span></div>` : ""
  }<div class="co__sum"><span>Shipping</span><span>${shipping}</span></div><div class="co__sum co__sum--total"><span>Total</span><span>USD $${(sub - discount).toFixed(2)}</span></div></div></aside>`;
}
const contact = `<h2>Contact</h2><div class="co__field">Email</div><h2>Delivery</h2><div class="co__field">Country: United States</div><div class="co__field">Address</div>`;
const opt = (label, right = "", { on = false, gone = false, tag = "", warn = false } = {}) =>
  `<div class="co__opt${on ? " is-on" : ""}${gone ? " is-gone" : ""}"><i></i><span><b>${label}</b></span>${right ? `<span style="flex:none">${right}</span>` : ""}${tag ? `<em class="co__tag${warn ? " co__tag--warn" : ""}">${tag}</em>` : ""}</div>`;
const note = (text) => `<p class="co__note">${text}</p>`;
const page = (main, side = summary(), label = "") => `${CSS}<div class="co">${top(label)}<div class="page-width"><div class="co__grid"><div class="co__main">${main}</div>${side}</div></div></div>`;
const PAY = '<button class="co__pay" type="button">Pay now</button>';

export function checkoutDesigns() {
  return {
    payment_rules: [
      {
        title: "Hide a payment method over an amount",
        html: page(`${contact}<h2>Payment</h2><div class="co__opts">${opt("Credit card", "VISA · MC · AMEX", { on: true })}${opt("PayPal")}${opt("Cash on Delivery", "", { gone: true, tag: "Hidden over $100", warn: true })}</div>${PAY}${note("Rule in CRO Toolbox: hide “Cash on Delivery” when the order is over $100. Shoppers never see the hidden method.")}`),
      },
      {
        title: "Rename and move a payment method",
        html: page(`${contact}<h2>Payment</h2><div class="co__opts">${opt("Bank transfer: 2% off, paid on dispatch", "", { on: true, tag: "Renamed and moved first" })}${opt("Credit card", "VISA · MC · AMEX")}${opt("PayPal")}</div>${PAY}${note("Rules in CRO Toolbox: rename “Bank Deposit” and move it to the top of the list.")}`),
      },
    ],
    delivery_rules: [
      {
        title: "Hide a delivery option",
        html: page(`${contact}<h2>Shipping method</h2><div class="co__opts">${opt("Standard, 3 to 5 days", "Free", { on: true })}${opt("Express, next day", "$14.00", { gone: true, tag: "Hidden for this cart", warn: true })}</div>${PAY}${note("Rule in CRO Toolbox: hide “Express” when the cart has a candle (glass can't fly overnight).")}`),
      },
      {
        title: "Rename a delivery option",
        html: page(`${contact}<h2>Shipping method</h2><div class="co__opts">${opt("Free delivery in 3 to 5 days, tracked", "Free", { on: true, tag: "Renamed" })}${opt("Express, next day", "$14.00")}${opt("Pick up in store", "Free")}</div>${PAY}${note("Rule in CRO Toolbox: rename “Standard” so shoppers see what they get.")}`),
      },
    ],
    order_limits: [
      {
        title: "Minimum order total",
        html: page(`${contact}<div class="co__err"><span>⚠</span><span><b>The minimum order is $25.00.</b>Add a little more to your cart to check out.</span></div><h2>Payment</h2><div class="co__opts">${opt("Credit card", "VISA · MC · AMEX", { on: true })}</div>${PAY}${note("Limit in CRO Toolbox: minimum order total $25. Checkout won't complete below it.")}`, summary({ lines: [["oat-soap", "Oat Soap", "", 2, 9]] })),
      },
      {
        title: "Maximum quantity per product",
        html: page(`${contact}<div class="co__err"><span>⚠</span><span><b>Glow Serum: you can order up to 3.</b>Change the quantity in your cart to continue.</span></div><h2>Payment</h2><div class="co__opts">${opt("Credit card", "VISA · MC · AMEX", { on: true })}</div>${PAY}${note("Limit in CRO Toolbox: maximum 3 of Glow Serum per order, useful for launches and limited stock.")}`, summary({ lines: [["glow-serum", "Glow Serum", "30 ml", 5, 34]] })),
      },
    ],
    thank_you: [
      {
        title: "Discount code, message, follow us and products",
        html: `${CSS}<div class="co">${top("Order #1042")}<div class="page-width"><div class="co__grid"><div class="co__main ty"><div class="ty__check">✓</div><h2 style="margin-top:12px">Thank you, Alex!</h2><p style="color:#707070;margin:0">Your order is confirmed.</p>
<div class="ty__card"><span class="ty__mark">CRO Toolbox</span><h3>A thank you gift</h3><p style="margin:0">Use this code for 10% off your next order.</p><div class="ty__code"><code>THANKS10</code><button type="button" onclick="this.textContent='Copied'">Copy</button></div></div>
<div class="ty__card"><span class="ty__mark">CRO Toolbox</span><h3>What happens next</h3><p style="margin:0">We'll pack your order within 1 to 2 days and send you the tracking link.</p></div>
<div class="ty__card"><span class="ty__mark">CRO Toolbox</span><h3>Follow us</h3><p style="margin:0">New drops and offers first.</p><div class="ty__social"><span>Instagram</span><span>TikTok</span><span>Pinterest</span></div></div>
<div class="ty__card"><span class="ty__mark">CRO Toolbox</span><h3>You may also like</h3><div class="ty__prods">${["fig-candle", "daily-cream", "canvas-tote"].map((h) => `<span><img src="${img(h)}" alt=""><small>${h.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}</small></span>`).join("")}</div><p style="margin:10px 0 0"><span class="ty__btn">Shop now</span></p></div>
</div>${summary()}</div></div></div>`,
      },
    ],
    post_purchase: [
      {
        title: "One click offer after payment",
        html: `${CSS}<div class="co">${top("Payment received")}<div class="pp"><p style="color:#0b7a45;font-weight:700;margin:0">✓ Your order is confirmed</p><h1 style="font-size:26px;margin:8px 0 4px">Wait, add this to your order</h1><p style="color:#5a5c66;margin:0">A one time offer for you, shipped with your order. No need to enter your details again.</p>
<div class="pp__box"><img src="${img("daily-cream")}" alt="Daily Cream"><div><h2 style="margin:0 0 6px;font-size:20px">Daily Cream</h2><p class="pp__price">$23.80<s>$28.00</s><span class="pp__save">15% off</span></p><p style="color:#5a5c66">Light, everyday moisture that pairs with the serum you just bought.</p><button class="pp__accept" type="button" onclick="this.textContent='Added to your order';this.disabled=true">Pay now · $23.80</button><button class="pp__decline" type="button">Decline this offer</button></div></div>
<p class="co__note" style="text-align:left">Set in CRO Toolbox: the product and the discount. Shopify adds it to the paid order with one click; the button words are Shopify's own.</p></div></div>`,
      },
    ],
  };
}
