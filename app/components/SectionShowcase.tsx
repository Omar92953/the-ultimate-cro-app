/**
 * Section cards on Home: a preview of the section itself (centred), a floating action pill,
 * and the name + status underneath.
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
/** Centres one section in the preview. */
const Stage = ({ children, wide }: { children: ReactNode; wide?: boolean }) => (
  <span className={`${s.desk} ${wide ? s.deskWide : ""}`}>{children}</span>
);

/* ------------------------------------------------------------------ previews -- */
export function UpsellShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w30}`}>
        <b className={s.h3}>Buy more, save more</b>
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
        <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
      </span>
    </Stage>
  );
}

export function CrossSellShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w30}`}>
        <b className={s.h3}>Pairs well with</b>
        <span className={s.pairs}>
          {[3, 4, 1].map((k, i) => (
            <span key={k} className={s.pair}>
              <span className={`${s.check} ${i < 2 ? s.checkOn : ""}`} />
              <Img id={PRODUCTS[k].id} w={80} h={80} className={s.pairImg} />
              <span className={s.pairText}>
                <b>{PRODUCTS[k].name}</b>
                <small>
                  {PRODUCTS[k].price} <s className={s.muted}>−10%</s>
                </small>
              </span>
            </span>
          ))}
        </span>
        <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add 2 selected to cart</span>
      </span>
    </Stage>
  );
}

const CLIPS = [
  { photo: PHOTO.sunny, cap: "How to style", p: 3 },
  { video: true, cap: "Unboxing", p: 0 },
  { photo: PHOTO.pink, cap: "Everyday look", p: 1 },
  { photo: PHOTO.yellow, cap: "In use", p: 2 },
];
export function VideosShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w50}`}>
        <b className={s.h3}>See it in action</b>
        <span className={s.clips}>
          {CLIPS.map((c) => (
            <span key={c.cap} className={s.clip}>
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
          ))}
        </span>
      </span>
    </Stage>
  );
}

export function BundlesShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w50}`}>
        <span className={s.between}>
          <b className={s.h3}>Any 3 for LE 3,999</b>
          <span className={s.count}>2 / 3</span>
        </span>
        <span className={s.picks}>
          {[0, 1, 2, 3, 4].map((k, i) => (
            <span key={k} className={`${s.pick} ${i < 2 ? s.picked : ""}`}>
              <Img id={PRODUCTS[k].id} w={160} h={160} />
              {i < 2 ? <span className={s.pickTick}>✓</span> : null}
              <small>{PRODUCTS[k].name}</small>
            </span>
          ))}
        </span>
        <span className={s.summary}>
          <span className={s.meter}>
            <i />
          </span>
          <span>
            <b>LE 3,999</b> <s className={s.muted}>LE 4,750</s>
          </span>
          <span className={`${s.btn} ${s.btnDark}`}>Choose 1 more</span>
        </span>
      </span>
    </Stage>
  );
}

const REVIEWS = [
  { t: "I have very sensitive skin", n: "Barbara · Cairo", src: s.wa },
  { t: "I adopted it!", n: "Cathrine · Giza", src: s.ig, photo: PHOTO.pink },
  { t: "Wearing it in the video", n: "Omar · Alexandria", src: s.tt, video: true },
  { t: "Arrived in two days", n: "Nour · Cairo", src: s.fb },
];
export function ReviewsShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.center} ${s.w56}`}>
        <b className={s.h3}>What our customers say</b>
        <span className={s.rating}>
          <b>4.8</b> <Stars /> <small className={s.muted}>Based on 1,284 reviews</small>
        </span>
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
              {r.photo || r.video ? <Lines w={[90]} /> : <Lines w={[100, 90, 60]} />}
              <small className={s.muted}>
                {r.n} <span className={s.verified}>✓ Verified</span>
              </small>
            </span>
          ))}
        </span>
      </span>
    </Stage>
  );
}

const QS = ["How long does delivery take?", "Can I pay cash on delivery?", "What is your return policy?", "Do you ship outside Egypt?"];
export function FaqShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w40}`}>
        <b className={`${s.h2} ${s.centerText}`}>Frequently asked questions</b>
        <span className={`${s.chips} ${s.centerRow}`}>
          <i className={s.on}>All</i>
          <i>Shipping</i>
          <i>Payment</i>
          <i>Returns</i>
        </span>
        <span className={s.faq}>
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
    </Stage>
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
    <Stage wide>
      <span className={s.logos}>
        <b className={s.h3}>Trusted by</b>
        <Marks />
        <span className={s.band}>
          <Marks shift={3} />
        </span>
      </span>
    </Stage>
  );
}

export function AnnouncementShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w52}`}>
        <span className={s.annWrap}>
          <span className={s.annBar}>
            <span>‹</span>
            <span>🚚 Spend LE 150 more for free delivery</span>
            <span>›</span>
          </span>
          <span className={s.progress} />
        </span>
        <span className={`${s.annBar} ${s.annAlt}`}>
          <span>‹</span>
          <span>🎁 Eid sale: 20% off everything</span>
          <span>›</span>
        </span>
      </span>
    </Stage>
  );
}

export function QuickAddShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w46}`}>
        <span className={s.products4}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={s.product}>
              <span className={s.productImg}>
                <Img id={PRODUCTS[i].id} w={240} h={240} />
                <span className={`${s.qa} ${i === 0 ? s.qaDone : ""}`}>{i === 0 ? "✓" : "+"}</span>
              </span>
              <b>{PRODUCTS[i].name}</b>
              <small>{PRODUCTS[i].price}</small>
            </span>
          ))}
        </span>
        <span className={s.picker}>
          <b>Sunglasses</b>
          <span className={s.chips}>
            <i>S</i>
            <i className={s.on}>M</i>
            <i>L</i>
            <i className={s.out}>XL</i>
          </span>
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart · LE 890</span>
        </span>
      </span>
    </Stage>
  );
}

export function HeroShowcase() {
  return (
    <Stage>
      <span className={s.hero}>
        <Img id={PHOTO.shopper} w={900} h={460} className={s.cover} />
        <span className={s.heroCopy}>
          <span className={s.tag}>NOW ON SALE</span>
          <b className={s.heroH}>Reduce stress. Sleep peacefully.</b>
          <span>
            <Stars /> 4.8 · 12,000 reviews
          </span>
          <span className={s.row}>
            <span className={`${s.btn} ${s.btnBlue}`}>SHOP NOW</span>
            <span className={`${s.btn} ${s.btnDark}`}>LEARN MORE</span>
          </span>
        </span>
      </span>
    </Stage>
  );
}

export function CountdownShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.center} ${s.w40} ${s.cd}`}>
        <span className={s.tag}>SUMMER SALE</span>
        <b className={s.h2}>Hurry — the sale ends soon</b>
        <small className={s.muted}>Up to 30% off everything.</small>
        <span className={s.timer}>
          {[
            ["02", "Days"],
            ["14", "Hours"],
            ["36", "Min"],
            ["09", "Sec"],
          ].map(([n, l]) => (
            <span key={l} className={s.unit}>
              <b>{n}</b>
              <small>{l}</small>
            </span>
          ))}
        </span>
        <span className={`${s.btn} ${s.btnDark}`}>Shop now</span>
      </span>
    </Stage>
  );
}

export function CountdownBarShowcase() {
  return (
    <Stage>
      <span className={`${s.cdBar} ${s.w52}`}>
        <b>Sale ends in</b>
        <span className={s.cdDigits}>
          <i>05</i>:<i>12</i>:<i>44</i>
        </span>
        <span className={`${s.btn} ${s.btnLight}`}>Shop now</span>
        <span className={s.cdClose}>✕</span>
      </span>
    </Stage>
  );
}
