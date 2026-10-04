/**
 * "Store sections" showcase cards on Home: a detailed desktop mock-up of each section with a
 * phone showing the mobile version, a floating action pill, and the name + status underneath.
 * Previews are decorative (aria-hidden) and scale with the card (sizes are in em, the root
 * font-size follows the card width through container query units).
 *
 * Photos: Unsplash (free to use under the Unsplash License, no attribution required), loaded
 * from images.unsplash.com as Unsplash asks. Video: MDN's CC0 sample clip.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import s from "./SectionShowcase.module.css";

type Target = { href: string; external?: boolean };

function Go(props: Target & { className: string; children: ReactNode; label?: string }) {
  return props.external ? (
    <a className={props.className} href={props.href} target="_top" aria-label={props.label}>
      {props.children}
    </a>
  ) : (
    <Link className={props.className} to={props.href} aria-label={props.label}>
      {props.children}
    </Link>
  );
}

export function SectionCard(props: {
  title: string;
  status: { tone: "success" | "warning" | "neutral"; text: string };
  action: Target & { label: string; done?: boolean };
  open: Target;
  preview: ReactNode;
  /** Features can be switched off without removing them from the theme. */
  toggle?: { on: boolean; onChange: (on: boolean) => void };
  off?: boolean;
}) {
  return (
    <div className={`${s.card} ${props.off ? s.off : ""}`}>
      {props.toggle ? (
        <button
          type="button"
          className={`${s.toggle} ${props.toggle.on ? s.toggleOn : ""}`}
          role="switch"
          aria-checked={props.toggle.on}
          aria-label={`${props.title}: ${props.toggle.on ? "on" : "off"}`}
          onClick={() => props.toggle!.onChange(!props.toggle!.on)}
        >
          <span className={s.knob} />
          {props.toggle.on ? "On" : "Off"}
        </button>
      ) : null}
      <Go className={s.stage} href={props.open.href} external={props.open.external} label={`Open ${props.title}`}>
        <span className={s.canvas} aria-hidden="true">
          {props.preview}
        </span>
      </Go>
      <Go className={`${s.pill} ${props.action.done ? s.pillDone : ""}`} href={props.action.href} external={props.action.external}>
        <span aria-hidden="true">{props.action.done ? "✓" : "+"}</span> {props.action.label}
      </Go>
      <div className={s.foot}>
        <Go className={s.title} href={props.open.href} external={props.open.external}>
          {props.title}
        </Go>
        <span className={`${s.status} ${s[props.status.tone]}`}>{props.status.text}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ building bits -- */
const Stars = ({ n = 5 }: { n?: number }) => <span className={s.stars}>{"★".repeat(n) + "☆".repeat(5 - n)}</span>;
const Lines = ({ w }: { w: number[] }) => (
  <span className={s.lines}>
    {w.map((x, i) => (
      <i key={i} style={{ width: `${x}%` }} />
    ))}
  </span>
);
const Phone = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <span className={`${s.phone} ${className}`}>
    <span className={s.notch} />
    <span className={s.screen}>{children}</span>
  </span>
);
const Head = () => (
  <span className={s.siteHead}>
    <b>LUMA</b>
    <span className={s.nav}>
      <i>Shop</i>
      <i>About</i>
      <i>Contact</i>
    </span>
  </span>
);
const U = (id: string, w: number, h: number) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=60&auto=format`;
const PHOTO = {
  shopper: "1483985988355-763728e1935b",
  yellow: "1515886657613-9f3515b0c78f",
  pink: "1503342217505-b0a15ec3261c",
  sunny: "1469334031218-e382a71b716b",
};
const VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const PRODUCTS = [
  { name: "Wireless headphones", price: "LE 1,450", id: "1505740420928-5e560c06d30e" },
  { name: "Classic watch", price: "LE 2,300", id: "1523275335684-37898b6baf30" },
  { name: "Instant camera", price: "LE 3,100", id: "1526170375885-4d8ecf77b99f" },
  { name: "Sunglasses", price: "LE 890", id: "1572635196237-14b3f281503f" },
  { name: "Ceramic mug", price: "LE 220", id: "1514228742587-6b1558fcca3d" },
];
const Img = ({ id, w, h, className }: { id: string; w: number; h: number; className?: string }) => (
  <img className={className} src={U(id, w, h)} alt="" loading="lazy" decoding="async" />
);
const Product = ({ i, add, done }: { i: number; add?: boolean; done?: boolean }) => {
  const p = PRODUCTS[i % PRODUCTS.length];
  return (
    <span className={s.product}>
      <span className={s.productImg}>
        <Img id={p.id} w={240} h={240} />
        {add ? <span className={`${s.qa} ${done ? s.qaDone : ""}`}>{done ? "✓" : "+"}</span> : null}
      </span>
      <b>{p.name}</b>
      <small>{p.price}</small>
    </span>
  );
};

/** Grey stand-in for the store page around a section (no photos: they aren't part of it). */
const PageSkeleton = ({ phone }: { phone?: boolean }) => (
  <>
    <Head />
    <span className={`${s.skelHero} ${phone ? s.skelHeroM : ""}`}>
      <Lines w={[45, 30]} />
    </span>
    <span className={phone ? s.skelGrid2 : s.skelGrid3}>
      {(phone ? [0, 1] : [0, 1, 2]).map((i) => (
        <span key={i} className={s.skelCard}>
          <span className={s.skelImg} />
          <Lines w={[80, 45]} />
        </span>
      ))}
    </span>
  </>
);
/** Product-page context for upsell / cross-sell: title and price as placeholders, no photo. */
const PdpSkeleton = () => (
  <span className={s.pdpSkel}>
    <small className={s.muted}>Product page</small>
    <Lines w={[70]} />
    <Lines w={[35]} />
  </span>
);

/* ------------------------------------------------------------------ previews -- */
export function HeroShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.heroD}`}>
        <Img id={PHOTO.shopper} w={900} h={500} className={s.cover} />
        <span className={s.heroCopy}>
          <span className={s.tag}>NOW ON SALE</span>
          <b className={s.heroH}>Reduce stress. Sleep peacefully.</b>
          <span className={s.heroRate}>
            <Stars /> 4.8 based on 12,000 reviews
          </span>
          <span className={s.ticks}>
            <i>Calm nights</i>
            <i>Free delivery</i>
            <i>30-day returns</i>
          </span>
          <span className={s.row}>
            <span className={`${s.btn} ${s.btnBlue}`}>SHOP NOW</span>
            <span className={`${s.btn} ${s.btnDark}`}>LEARN MORE</span>
          </span>
        </span>
      </span>
      <Phone>
        <span className={s.heroM}>
          <Img id={PHOTO.yellow} w={300} h={600} className={s.cover} />
          <span className={s.tag}>NOW ON SALE</span>
          <b className={s.heroHm}>Reduce stress. Sleep peacefully.</b>
          <Stars />
          <span className={`${s.btn} ${s.btnBlue} ${s.full}`}>SHOP NOW</span>
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>LEARN MORE</span>
        </span>
      </Phone>
    </>
  );
}

const REVIEWS = [
  { t: "I have very sensitive skin", n: "Barbara · 30 Sep", src: s.wa },
  { t: "I adopted it!", n: "Cathrine · 29 Jul", src: s.ig, photo: PHOTO.pink },
  { t: "Wearing it in the video", n: "Omar · 12 Aug", src: s.tt, video: true },
  { t: "Arrived in two days", n: "Nour · 3 Sep", src: s.fb },
];
export function ReviewsShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.reviewsD}`}>
        <b className={s.h2}>Our customers tell it better than we do!</b>
        <span className={s.rating}>
          Excellent <b>4.8 / 5</b> <Stars />
        </span>
        <small className={s.muted}>based on 1,284 reviews</small>
        <span className={s.reviewRow}>
          {REVIEWS.map((r, i) => (
            <span key={r.t} className={s.reviewCard}>
              {r.photo ? <Img id={r.photo} w={300} h={220} className={s.reviewPhoto} /> : null}
              {r.video ? (
                <span className={s.reviewVideo}>
                  <video src={VIDEO} muted autoPlay loop playsInline preload="metadata" />
                  <span className={s.sound}>🔇</span>
                </span>
              ) : null}
              <span className={s.between}>
                <Stars n={i === 2 ? 4 : 5} />
                <span className={`${s.src} ${r.src}`} />
              </span>
              <b>{r.t}</b>
              {r.photo || r.video ? <Lines w={[100, 70]} /> : <Lines w={[100, 94, 88, 60]} />}
              <small className={s.muted}>{r.n}</small>
            </span>
          ))}
        </span>
        <span className={`${s.btn} ${s.btnDark}`}>View all</span>
      </span>
      <Phone>
        <span className={s.reviewsM}>
          <b className={s.h3}>Our customers tell it better</b>
          <Stars />
          <span className={s.reviewCard}>
            <Img id={PHOTO.sunny} w={300} h={260} className={s.reviewPhoto} />
            <span className={s.between}>
              <Stars />
              <span className={`${s.src} ${s.wa}`} />
            </span>
            <b>I adopted it!</b>
            <Lines w={[100, 90, 70]} />
            <small className={s.muted}>Cathrine · 29 Jul</small>
          </span>
          <span className={s.dots}>
            <i className={s.on} />
            <i />
            <i />
            <i />
          </span>
        </span>
      </Phone>
    </>
  );
}

const QS = ["How long does delivery take?", "Can I pay cash on delivery?", "What is your return policy?", "Do you ship outside Egypt?"];
export function FaqShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.faqD}`}>
        <span className={s.faqSide}>
          <b className={s.h2}>Questions? We&apos;ve got answers</b>
          <Lines w={[90, 70]} />
          <span className={`${s.btn} ${s.btnDark}`}>Contact us</span>
        </span>
        <span className={s.faqMain}>
          <span className={s.chips}>
            <i className={s.on}>All</i>
            <i>Shipping</i>
            <i>Payment</i>
            <i>Returns</i>
          </span>
          {QS.map((q, i) => (
            <span key={q} className={s.faqRow}>
              <span className={s.between}>
                <b>{q}</b>
                <span>{i === 0 ? "−" : "+"}</span>
              </span>
              {i === 0 ? <Lines w={[95, 60]} /> : null}
            </span>
          ))}
        </span>
      </span>
      <Phone>
        <span className={s.faqM}>
          <b className={s.h3}>FAQ</b>
          <span className={s.search}>⌕ Search questions</span>
          {QS.slice(0, 3).map((q, i) => (
            <span key={q} className={s.faqRow}>
              <span className={s.between}>
                <b>{q}</b>
                <span>{i === 0 ? "−" : "+"}</span>
              </span>
              {i === 0 ? <Lines w={[95, 70]} /> : null}
            </span>
          ))}
        </span>
      </Phone>
    </>
  );
}

const MARKS = [
  { t: "allure", c: s.serif },
  { t: "InStyle", c: s.sans },
  { t: "VOGUE", c: s.didone },
  { t: "BUSTLE", c: s.wide },
  { t: "Forbes", c: s.serif },
  { t: "ELLE", c: s.didone },
];
const Marks = ({ shift = 0 }: { shift?: number }) => (
  <span className={s.marks}>
    {[...MARKS.slice(shift), ...MARKS, ...MARKS.slice(0, shift)].map((m, i) => (
      <i key={i} className={m.c}>
        {m.t}
      </i>
    ))}
  </span>
);
export function LogosShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.logosD}`}>
        <b className={s.h3}>Trusted by</b>
        <Marks />
        <span className={s.band}>
          <Marks shift={3} />
        </span>
      </span>
      <Phone>
        <span className={s.logosM}>
          <b className={s.h3}>Trusted by</b>
          <Marks shift={1} />
          <span className={s.band}>
            <Marks shift={4} />
          </span>
        </span>
      </Phone>
    </>
  );
}

export function AnnouncementShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.pageD}`}>
        <span className={s.annBar}>
          <span>‹</span>
          <span>🚚 Spend LE 150 more for free delivery</span>
          <span>›</span>
        </span>
        <span className={s.progress} />
        <PageSkeleton />
      </span>
      <Phone>
        <span className={s.annBar}>
          <span>🎁 Eid sale: 20% off</span>
        </span>
        <span className={s.progress} />
        <PageSkeleton phone />
      </Phone>
    </>
  );
}

export function QuickAddShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.qaD}`}>
        <b className={s.h3}>New arrivals</b>
        <span className={s.products4}>
          {[0, 1, 2, 3].map((i) => (
            <Product key={i} i={i} add done={i === 0} />
          ))}
        </span>
        <span className={s.picker}>
          <b>Linen cap</b>
          <small className={s.muted}>Size</small>
          <span className={s.chips}>
            <i>S</i>
            <i className={s.on}>M</i>
            <i>L</i>
            <i className={s.out}>XL</i>
          </span>
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart · LE 290</span>
        </span>
      </span>
      <Phone>
        <span className={s.qaM}>
          <b className={s.h3}>New arrivals</b>
          <span className={s.products2}>
            <Product i={2} add />
            <Product i={3} add />
          </span>
          <span className={s.sheet}>
            <b>Added to your cart!</b>
            <span className={s.row}>
              <span className={`${s.btn} ${s.btnLight}`}>View cart</span>
              <span className={`${s.btn} ${s.btnDark}`}>Checkout</span>
            </span>
          </span>
        </span>
      </Phone>
    </>
  );
}

const Timer = ({ labels = true }: { labels?: boolean }) => (
  <span className={s.timer}>
    {[
      ["02", "Days"],
      ["14", "Hours"],
      ["36", "Min"],
      ["09", "Sec"],
    ].map(([n, l]) => (
      <span key={l} className={s.unit}>
        <b>{n}</b>
        {labels ? <small>{l}</small> : null}
      </span>
    ))}
  </span>
);
export function CountdownShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.cdD}`}>
        <span className={s.cdCopy}>
          <span className={s.tag}>SUMMER SALE</span>
          <b className={s.h2}>Hurry — the sale ends soon</b>
          <small className={s.muted}>Up to 30% off everything. Don&apos;t miss out.</small>
        </span>
        <Timer />
        <span className={`${s.btn} ${s.btnDark}`}>Shop now</span>
      </span>
      <Phone>
        <span className={s.cdM}>
          <span className={s.tag}>SUMMER SALE</span>
          <b className={s.h3}>The sale ends soon</b>
          <Timer />
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Shop now</span>
          <small className={s.muted}>Order in the next 3h 20m for same-day dispatch</small>
        </span>
      </Phone>
    </>
  );
}

export function CountdownBarShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.pageD}`}>
        <PageSkeleton />
        <span className={s.cdBar}>
          <b>Sale ends in</b>
          <span className={s.cdDigits}>
            <i>05</i>:<i>12</i>:<i>44</i>
          </span>
          <span className={`${s.btn} ${s.btnLight}`}>Shop now</span>
          <span>✕</span>
        </span>
      </span>
      <Phone>
        <PageSkeleton phone />
        <span className={s.cdBar}>
          <b>Ends in</b>
          <span className={s.cdDigits}>
            <i>05</i>:<i>12</i>:<i>44</i>
          </span>
        </span>
      </Phone>
    </>
  );
}

/* ---------------------------------------------------------- feature previews -- */
const Tiers = () => (
  <span className={s.tiers}>
    {[
      ["Buy 1", "LE 1,450", "", ""],
      ["Buy 2", "LE 2,610", "LE 2,900", "Save 10%"],
      ["Buy 3", "LE 3,700", "LE 4,350", "Save 15%"],
    ].map(([l, p, was, save], i) => (
      <span key={l} className={`${s.tier} ${i === 2 ? s.tierOn : ""}`}>
        {save ? (
          <span className={s.tierTags}>
            <i>{save}</i>
            {i === 2 ? <i className={s.tierBadge}>Most popular</i> : null}
          </span>
        ) : null}
        <span className={s.radio} />
        <b>{l}</b>
        {was ? <s className={s.muted}>{was}</s> : null}
        <b>{p}</b>
      </span>
    ))}
  </span>
);
export function UpsellShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.pdpD}`}>
        <span className={s.widget}>
          <PdpSkeleton />
          <b className={s.h3}>Buy more, save more</b>
          <Tiers />
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
        </span>
      </span>
      <Phone>
        <span className={s.pdpM}>
          <PdpSkeleton />
          <b>Buy more, save more</b>
          <Tiers />
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
        </span>
      </Phone>
    </>
  );
}

const Pairs = ({ n = 3 }: { n?: number }) => (
  <span className={s.pairs}>
    {[3, 4, 1].slice(0, n).map((k, i) => (
      <span key={k} className={s.pair}>
        <span className={`${s.check} ${i < 2 ? s.checkOn : ""}`} />
        <Img id={PRODUCTS[k].id} w={80} h={80} className={s.pairImg} />
        <span className={s.pairText}>
          <b>{PRODUCTS[k].name}</b>
          <small>
            {PRODUCTS[k].price} <s className={s.muted}>-10%</s>
          </small>
        </span>
      </span>
    ))}
  </span>
);
export function CrossSellShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.pdpD}`}>
        <span className={s.widget}>
          <PdpSkeleton />
          <b className={s.h3}>Pairs well with</b>
          <Pairs />
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add 2 selected to cart · save 10%</span>
        </span>
      </span>
      <Phone>
        <span className={s.pdpM}>
          <PdpSkeleton />
          <b className={s.small}>Pairs well with</b>
          <Pairs n={2} />
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add selected</span>
        </span>
      </Phone>
    </>
  );
}

const CLIPS = [
  { photo: PHOTO.sunny, cap: "How to style", p: 3 },
  { video: true, cap: "Unboxing", p: 0 },
  { photo: PHOTO.pink, cap: "Everyday look", p: 1 },
  { photo: PHOTO.yellow, cap: "In use", p: 2 },
];
const Clip = ({ c }: { c: (typeof CLIPS)[number] }) => (
  <span className={s.clip}>
    <span className={s.clipMedia}>
      {c.video ? <video src={VIDEO} muted autoPlay loop playsInline preload="metadata" /> : <Img id={c.photo!} w={240} h={420} />}
      <span className={s.clipPlay}>▶</span>
      <span className={s.clipCap}>{c.cap}</span>
    </span>
    <span className={s.clipProduct}>
      <Img id={PRODUCTS[c.p].id} w={60} h={60} className={s.clipThumb} />
      <span className={s.pairText}>
        <b>{PRODUCTS[c.p].name}</b>
        <small>{PRODUCTS[c.p].price}</small>
      </span>
      <span className={s.qaMini}>+</span>
    </span>
  </span>
);
export function VideosShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.clipsD}`}>
        <b className={s.h3}>See it in action</b>
        <span className={s.clips}>
          {CLIPS.map((c) => (
            <Clip key={c.cap} c={c} />
          ))}
        </span>
      </span>
      <Phone>
        <span className={s.clipsM}>
          <b className={s.h3}>See it in action</b>
          <span className={s.clips}>
            <Clip c={CLIPS[1]} />
            <Clip c={CLIPS[0]} />
          </span>
        </span>
      </Phone>
    </>
  );
}

const Picks = ({ n }: { n: number }) => (
  <span className={s.picks}>
    {[0, 1, 2, 3, 4, 3].slice(0, n).map((k, i) => (
      <span key={i} className={`${s.pick} ${i < 2 ? s.picked : ""}`}>
        <Img id={PRODUCTS[k].id} w={160} h={160} />
        {i < 2 ? <span className={s.pickTick}>✓</span> : null}
        <small>{PRODUCTS[k].name}</small>
      </span>
    ))}
  </span>
);
export function BundlesShowcase() {
  return (
    <>
      <span className={`${s.desk} ${s.bundleD}`}>
        <span className={s.between}>
          <b className={s.h3}>Build your bundle · any 3 for LE 3,999</b>
          <span className={s.count}>2 / 3</span>
        </span>
        <Picks n={5} />
        <span className={s.summary}>
          <span className={s.meter}>
            <i />
          </span>
          <span>
            Total <b>LE 3,999</b> <s className={s.muted}>LE 4,750</s>
          </span>
          <span className={`${s.btn} ${s.btnDark}`}>Choose 1 more</span>
        </span>
      </span>
      <Phone>
        <span className={s.bundleM}>
          <b className={s.h3}>Any 3 for LE 3,999</b>
          <Picks n={4} />
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Choose 1 more · 2/3</span>
        </span>
      </Phone>
    </>
  );
}
