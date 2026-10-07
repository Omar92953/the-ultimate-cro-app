/**
 * Section cards on Home: previews of the section itself (centred) that scroll with small arrows,
 * and underneath the name, one status line with the next step, a bookmark and a ⋯ menu.
 * Previews are decorative (aria-hidden) and scale with the card (sizes are in em, the root
 * font-size follows the card width through container query units).
 *
 * Photos: Unsplash (free to use under the Unsplash License, no attribution required), loaded
 * from images.unsplash.com as Unsplash asks. Video: MDN's CC0 sample clip.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
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

export type CardMenuItem = (Target & { label: string }) | { label: string; onClick: () => void };

export function SectionCard(props: {
  title: string;
  /** One line under the name: what state it's in, and the next step when one is needed. */
  status: { tone: "success" | "warning" | "neutral"; text: string };
  next?: Target & { label: string };
  open: Target;
  /** One or more looks of the section; arrows scroll between them. */
  previews: ReactNode[];
  /** Everything else (manage, turn on/off, theme editor) lives in the ⋯ menu. */
  menu?: CardMenuItem[];
  off?: boolean;
  /** Bookmark: saved cards are listed under Home → Saved. */
  save?: { saved: boolean; onChange: (saved: boolean) => void };
}) {
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const count = props.previews.length;
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);
  return (
    <div className={`${s.card} ${props.off ? s.off : ""}`}>
      <div className={s.stage}>
        <Go className={s.stageLink} href={props.open.href} external={props.open.external} label={`Open ${props.title}`}>
          <span className={s.track} style={{ transform: `translateX(-${index * 100}%)` }} aria-hidden="true">
            {props.previews.map((preview, i) => (
              <span key={i} className={s.canvas}>
                {preview}
              </span>
            ))}
          </span>
        </Go>
        {count > 1 ? (
          <>
            <button type="button" className={`${s.arrow} ${s.arrowPrev}`} aria-label={`Previous ${props.title} look`} onClick={() => go(-1)}>
              ‹
            </button>
            <button type="button" className={`${s.arrow} ${s.arrowNext}`} aria-label={`Next ${props.title} look`} onClick={() => go(1)}>
              ›
            </button>
            <span className={s.dots}>
              {props.previews.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${s.dot} ${i === index ? s.dotOn : ""}`}
                  aria-label={`Look ${i + 1} of ${count}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                />
              ))}
            </span>
          </>
        ) : null}
      </div>
      <div className={s.foot}>
        <div className={s.head}>
          <Go className={s.title} href={props.open.href} external={props.open.external}>
            {props.title}
          </Go>
          <span className={s.footEnd}>
            {props.save ? (
              <button
                type="button"
                className={`${s.iconBtn} ${s.save} ${props.save.saved ? s.saveOn : ""}`}
                aria-pressed={props.save.saved}
                aria-label={props.save.saved ? `Remove ${props.title} from saved` : `Save ${props.title}`}
                title={props.save.saved ? "Saved" : "Save"}
                onClick={() => props.save!.onChange(!props.save!.saved)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5.5 3h9A1.5 1.5 0 0 1 16 4.5V17l-6-3.6L4 17V4.5A1.5 1.5 0 0 1 5.5 3Z" />
                </svg>
              </button>
            ) : null}
            {props.menu?.length ? (
              <div className={s.menuWrap} ref={menuRef}>
                <button
                  type="button"
                  className={`${s.iconBtn} ${menuOpen ? s.iconBtnOn : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={`Manage ${props.title}`}
                  title="Manage"
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className={s.dotsIcon}>
                    <circle cx="4.5" cy="10" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="15.5" cy="10" r="1.5" />
                  </svg>
                </button>
                {menuOpen ? (
                  <div className={s.menu} role="menu">
                    {props.menu.map((m) =>
                      "onClick" in m ? (
                        <button
                          key={m.label}
                          type="button"
                          role="menuitem"
                          className={s.menuItem}
                          onClick={() => {
                            setMenuOpen(false);
                            m.onClick();
                          }}
                        >
                          {m.label}
                        </button>
                      ) : (
                        <span key={m.label} role="none" onClick={() => setMenuOpen(false)}>
                          <Go className={s.menuItem} href={m.href} external={m.external}>
                            {m.label}
                            {m.external ? <span aria-hidden="true"> ↗</span> : null}
                          </Go>
                        </span>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </span>
        </div>
        <div className={s.statusLine}>
          <span className={`${s.dotTone} ${s[props.status.tone]}`} aria-hidden="true" />
          <span className={s.statusText}>{props.status.text}</span>
          {props.next ? (
            <Go className={s.next} href={props.next.href} external={props.next.external}>
              {props.next.label} →
            </Go>
          ) : null}
        </div>
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
  { name: "Wireless headphones", price: "$79", id: "1505740420928-5e560c06d30e" },
  { name: "Classic watch", price: "$129", id: "1523275335684-37898b6baf30" },
  { name: "Instant camera", price: "$149", id: "1526170375885-4d8ecf77b99f" },
  { name: "Sunglasses", price: "$45", id: "1572635196237-14b3f281503f" },
  { name: "Ceramic mug", price: "$18", id: "1514228742587-6b1558fcca3d" },
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
            ["Buy 1", "$79", "", ""],
            ["Buy 2", "$142", "$158", "Save 10%"],
            ["Buy 3", "$201", "$237", "Save 15%"],
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
          <b className={s.h3}>Any 3 for $299</b>
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
            <b>$299</b> <s className={s.muted}>$357</s>
          </span>
          <span className={`${s.btn} ${s.btnDark}`}>Choose 1 more</span>
        </span>
      </span>
    </Stage>
  );
}

/* Reviews: the storefront card — picture on top (a chat screenshot or a product photo, all the same
   height), the channel badge in its corner, stars, the review, name · city · date, then the product. */
type Rv = { t: string; who: string; date: string; src: string; stars: number; shot?: string[]; photo?: string; product: number };
const REVIEWS: Rv[] = [
  { t: "Arrived in two days, the quality is amazing", who: "Mariam · Cairo", date: "12 Sep", src: s.wa, stars: 5, shot: ["Arrived in two days 😍", "the quality is amazing!!"], product: 0 },
  { t: "Wearing it every day", who: "Cathrine · Giza", date: "3 Sep", src: s.ig, stars: 5, photo: PHOTO.pink, product: 1 },
  { t: "Best purchase this month", who: "Youssef · Alexandria", date: "28 Aug", src: s.wa, stars: 4, shot: ["Best purchase this month 👌", "works perfectly"], product: 2 },
  { t: "Ordering another one", who: "Nour · Cairo", date: "21 Aug", src: s.fb, stars: 5, shot: ["Ordering another one for my sister"], product: 3 },
];
function ReviewCard({ r, text = true, fill }: { r: Rv; text?: boolean; fill?: string }) {
  const p = PRODUCTS[r.product];
  return (
    <span className={s.rvCard}>
      <span className={`${s.rvMedia} ${fill ?? ""}`}>
        {r.photo ? (
          <Img id={r.photo} w={300} h={300} className={s.rvPhoto} />
        ) : (
          <span className={s.rvShot}>
            {r.shot!.map((m, i) => (
              <span key={i} className={`${s.rvBubble} ${i % 2 ? s.rvBubbleMe : ""}`}>
                {m}
              </span>
            ))}
          </span>
        )}
        <span className={`${s.src} ${s.rvBadge} ${r.src}`} />
      </span>
      <span className={s.rvBody}>
        <Stars n={r.stars} />
        {text ? <b className={s.rvText}>{r.t}</b> : null}
        <small className={s.muted}>
          {r.who} · {r.date}
        </small>
        <span className={s.rvProd}>
          <Img id={p.id} w={80} h={80} />
          <span>
            <b>{p.name}</b>
            <small className={s.muted}>{p.price}</small>
          </span>
        </span>
      </span>
    </span>
  );
}
function ReviewsSection({ text, fill, heading = "What customers say" }: { text?: boolean; fill?: string; heading?: string }) {
  return (
    <Stage>
      <span className={`${s.plain} ${s.center} ${s.w56}`}>
        <span className={s.rvHead}>
          <b className={s.h3}>{heading}</b>
          <small className={s.muted}>Real messages from real customers</small>
          <span className={s.rating}>
            <b>4.8</b> <Stars /> <small className={s.muted}>Based on 1,284 reviews</small>
          </span>
        </span>
        <span className={s.rvRow}>
          {REVIEWS.map((r) => (
            <ReviewCard key={r.who} r={r} text={text} fill={fill} />
          ))}
        </span>
      </span>
    </Stage>
  );
}
export function ReviewsShowcase() {
  return <ReviewsSection text />;
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
            <span>🚚 Spend $15 more for free delivery</span>
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
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart · $45</span>
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

/* ------------------------------------------------- more looks per section -- */
export function UpsellSizesShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w30}`}>
        <b className={s.h3}>Choose your size</b>
        <span className={s.tiers}>
          {[
            ["Size M", "$79", "", ""],
            ["Size L", "$85", "$94", "Save 10%"],
            ["Size XL", "$89", "$111", "Save 20%"],
          ].map(([l, p, was, save], i) => (
            <span key={l} className={`${s.tier} ${i === 1 ? s.tierOn : ""}`}>
              {save ? (
                <span className={s.tierTags}>
                  <i>{save}</i>
                  {i === 1 ? <i className={s.tierBadge}>Best value</i> : null}
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

export function UpsellListShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w30}`}>
        <b className={s.h3}>Bundle & save</b>
        <span className={s.list}>
          {[
            ["1 pair", "Standard price", "$45", ""],
            ["2 pairs", "You save $9", "$81", "Popular"],
            ["3 pairs", "You save $20", "$115", ""],
          ].map(([l, sub, p, badge], i) => (
            <span key={l} className={`${s.listRow} ${i === 1 ? s.listOn : ""}`}>
              <span className={s.radio} />
              <span className={s.pairText}>
                <b>
                  {l} {badge ? <i className={s.miniBadge}>{badge}</i> : null}
                </b>
                <small className={s.muted}>{sub}</small>
              </span>
              <b className={s.push}>{p}</b>
            </span>
          ))}
        </span>
      </span>
    </Stage>
  );
}

export function CrossSellCardsShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w46}`}>
        <b className={s.h3}>Frequently bought together</b>
        <span className={s.fbt}>
          {[1, 3, 4].map((k, i) => (
            <span key={k} className={s.fbtItem}>
              <span className={s.productImg}>
                <Img id={PRODUCTS[k].id} w={240} h={240} />
                <span className={`${s.check} ${s.fbtCheck} ${i < 2 ? s.checkOn : ""}`} />
              </span>
              <small>{PRODUCTS[k].name}</small>
              <b>{PRODUCTS[k].price}</b>
              {i < 2 ? <span className={s.plus}>+</span> : null}
            </span>
          ))}
        </span>
        <span className={s.between}>
          <span>
            Total <b>$156</b> <s className={s.muted}>$174</s>
          </span>
          <span className={`${s.btn} ${s.btnDark}`}>Add 3 to cart</span>
        </span>
      </span>
    </Stage>
  );
}

export function VideosLargeShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w40}`}>
        <span className={s.clips2}>
          {[CLIPS[1], CLIPS[3]].map((c) => (
            <span key={c.cap} className={s.clip}>
              <span className={s.clipMedia}>
                {c.video ? <video src={VIDEO} muted autoPlay loop playsInline preload="metadata" /> : <Img id={c.photo!} w={320} h={520} />}
                <span className={s.clipPlay}>▶</span>
              </span>
              <span className={s.clipProduct}>
                <Img id={PRODUCTS[c.p].id} w={60} h={60} className={s.clipThumb} />
                <span className={s.pairText}>
                  <b>{PRODUCTS[c.p].name}</b>
                  <small>{PRODUCTS[c.p].price}</small>
                </span>
              </span>
              <span className={`${s.btn} ${s.btnDark} ${s.full} ${s.btnSm}`}>Add to cart</span>
            </span>
          ))}
        </span>
      </span>
    </Stage>
  );
}

export function BundlesStepsShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w46}`}>
        <span className={s.steps}>
          <i className={s.stepDone}>1. Pick 2 items ✓</i>
          <i className={s.stepOn}>2. Add a case</i>
          <i>3. Review</i>
        </span>
        <span className={s.picks3}>
          {[2, 3, 4].map((k, i) => (
            <span key={k} className={`${s.pick} ${i === 0 ? s.picked : ""}`}>
              <Img id={PRODUCTS[k].id} w={160} h={160} />
              {i === 0 ? <span className={s.pickTick}>✓</span> : null}
              <small>{PRODUCTS[k].name}</small>
            </span>
          ))}
        </span>
        <span className={s.summary}>
          <span>
            Bundle <b>$199</b> <s className={s.muted}>$239</s>
          </span>
          <span className={`${s.btn} ${s.btnDark}`}>Add bundle to cart</span>
        </span>
      </span>
    </Stage>
  );
}

/** Same cards, screenshots on a dotted fill. */
export function ReviewsChatShowcase() {
  return <ReviewsSection text fill={s.rvDots} heading="Real messages from customers" />;
}

/** Same cards with the review text switched off: picture, stars, name and product only. */
export function ReviewsPhotosShowcase() {
  return <ReviewsSection text={false} heading="Loved by our customers" />;
}

export function FaqCardsShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w52}`}>
        <span className={s.search}>⌕ Search questions</span>
        <span className={s.faqCards}>
          {QS.map((q, i) => (
            <span key={q} className={`${s.faqCard} ${i === 1 ? s.faqCardOpen : ""}`}>
              <span className={s.between}>
                <b>{q}</b>
                <span>{i === 1 ? "⌃" : "⌄"}</span>
              </span>
              {i === 1 ? <Lines w={[90, 55]} /> : null}
            </span>
          ))}
        </span>
        <span className={`${s.btn} ${s.btnDark} ${s.centerSelf}`}>Still have a question? Contact us</span>
      </span>
    </Stage>
  );
}

export function LogosOneLineShowcase() {
  return (
    <Stage wide>
      <span className={s.logos}>
        <b className={s.h3}>As seen in</b>
        <Marks shift={2} />
      </span>
    </Stage>
  );
}

export function LogosGridShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w46} ${s.center}`}>
        <b className={s.h3}>Trusted by 2,000+ brands</b>
        <span className={s.markGrid}>
          {MARKS.map((m) => (
            <i key={m.t} className={m.c}>
              {m.t}
            </i>
          ))}
        </span>
      </span>
    </Stage>
  );
}

export function AnnouncementShippingShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w52}`}>
        <span className={s.annWrap}>
          <span className={`${s.annBar} ${s.annCenter}`}>🚚 Spend $15 more for free delivery</span>
          <span className={s.progress} />
        </span>
        <span className={s.annWrap}>
          <span className={`${s.annBar} ${s.annCenter} ${s.annGreen}`}>🎉 You&apos;ve unlocked free delivery!</span>
          <span className={`${s.progress} ${s.progressFull}`} />
        </span>
      </span>
    </Stage>
  );
}

export function AnnouncementStyleShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w52}`}>
        <span className={`${s.annBar} ${s.annCenter} ${s.annBlue} ${s.annUpper}`}>⭐ New collection just dropped · Shop now</span>
        <span className={`${s.annBar} ${s.annCenter} ${s.annRose}`}>❤ Free gift wrapping on every order</span>
      </span>
    </Stage>
  );
}

export function QuickAddToastShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w46}`}>
        <span className={s.products4}>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={s.product}>
              <span className={s.productImg}>
                <Img id={PRODUCTS[i].id} w={240} h={240} />
                <span className={`${s.qa} ${i === 2 ? s.qaDone : ""}`}>{i === 2 ? "✓" : "+"}</span>
              </span>
              <b>{PRODUCTS[i].name}</b>
              <small>{PRODUCTS[i].price}</small>
            </span>
          ))}
        </span>
        <span className={s.toast}>
          <b>✓ Added to your cart!</b>
          <span className={s.row}>
            <span className={`${s.btn} ${s.btnLight} ${s.outline}`}>View cart</span>
            <span className={`${s.btn} ${s.btnDark}`}>Checkout</span>
          </span>
        </span>
      </span>
    </Stage>
  );
}

export function HeroCenteredShowcase() {
  return (
    <Stage>
      <span className={`${s.hero} ${s.heroCenter}`}>
        <Img id={PHOTO.yellow} w={900} h={460} className={s.cover} />
        <span className={s.heroBox}>
          <b className={s.heroH}>New season</b>
          <span>Bright colours for sunny days</span>
          <span className={`${s.btn} ${s.btnLight}`}>Shop the collection</span>
        </span>
      </span>
    </Stage>
  );
}

export function CountdownRowShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w52} ${s.cdRow}`}>
        <span className={s.pairText}>
          <b className={s.h3}>Flash sale — 40% off</b>
          <small className={s.muted}>Ends tonight at midnight</small>
        </span>
        <span className={s.timerPlain}>
          <b>05</b>:<b>42</b>:<b>17</b>
        </span>
        <span className={`${s.btn} ${s.btnDark}`}>Shop now</span>
      </span>
    </Stage>
  );
}

export function CountdownDailyShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w40} ${s.center}`}>
        <span className={s.dailyIcon}>🚚</span>
        <b className={s.h3}>Order in the next 3h 20m</b>
        <span className={s.muted}>and we ship it today</span>
        <span className={s.meterWide}>
          <i />
        </span>
      </span>
    </Stage>
  );
}

export function CountdownBarDarkShowcase() {
  return (
    <Stage>
      <span className={`${s.cdBar} ${s.cdBarDark} ${s.w52}`}>
        <b>Black Friday ends in</b>
        <span className={s.cdUnits}>
          {[
            ["01", "d"],
            ["06", "h"],
            ["14", "m"],
            ["52", "s"],
          ].map(([n, l]) => (
            <i key={l}>
              {n}
              <small>{l}</small>
            </i>
          ))}
        </span>
        <span className={`${s.btn} ${s.btnLight}`}>Get the deal</span>
      </span>
    </Stage>
  );
}

/* ---------------------------------------------------------------- boosters -- */
const ProductPage = ({ children }: { children: ReactNode }) => (
  <span className={s.pdpMini}>
    <Img id={PRODUCTS[1].id} w={300} h={300} className={s.pdpMiniImg} />
    <span className={s.pdpMiniInfo}>
      <b className={s.h3}>Classic watch</b>
      <span className={s.pdpMiniPrice}>
        $129 <s className={s.muted}>$159</s>
      </span>
      {children}
    </span>
  </span>
);

export function StickyShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w52}`}>
        <span className={s.ghostPage}>
          <Lines w={[60, 90, 75]} />
          <Lines w={[85, 50]} />
        </span>
        <span className={s.stickyBar}>
          <Img id={PRODUCTS[1].id} w={80} h={80} className={s.stickyImg} />
          <span className={s.pairText}>
            <b>Classic watch</b>
            <small>$129</small>
          </span>
          <span className={s.stickySelect}>Silver ▾</span>
          <span className={`${s.btn} ${s.btnDark}`}>Add to cart</span>
        </span>
      </span>
    </Stage>
  );
}

export function StickyMobileShowcase() {
  return (
    <Stage>
      <span className={s.phoneFrame}>
        <span className={s.ghostPage}>
          <Lines w={[70, 90, 60, 80]} />
        </span>
        <span className={`${s.stickyBar} ${s.stickyBarM}`}>
          <Img id={PRODUCTS[0].id} w={80} h={80} className={s.stickyImg} />
          <span className={s.pairText}>
            <b>Headphones</b>
            <small>$79</small>
          </span>
          <span className={`${s.btn} ${s.btnDark} ${s.btnSm}`}>Add</span>
        </span>
      </span>
    </Stage>
  );
}

export function UrgencyShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w46}`}>
        <ProductPage>
          <span className={s.urg}>
            <span className={s.urgDot} /> Hurry! Only 3 left in stock
          </span>
          <span className={s.urgBar}>
            <i />
          </span>
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
        </ProductPage>
      </span>
    </Stage>
  );
}

export function UrgencyLastShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w40} ${s.center}`}>
        <span className={`${s.urg} ${s.urgBig}`}>
          <span className={s.urgDot} /> Last one in stock!
        </span>
        <span className={`${s.urgBar} ${s.urgBarLast}`}>
          <i />
        </span>
        <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart · $45</span>
      </span>
    </Stage>
  );
}

const BADGES = [
  ["🔒", "Secure checkout"],
  ["🚚", "Fast delivery"],
  ["↩", "Free returns"],
  ["💵", "Cash on delivery"],
];
const PAYS = ["VISA", "MC", "AMEX", "PayPal", "Pay", "COD"];
export function TrustShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w46}`}>
        <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
        <span className={s.trustRow}>
          {BADGES.map(([i, t]) => (
            <span key={t}>
              <i>{i}</i>
              {t}
            </span>
          ))}
        </span>
        <span className={s.payRow}>
          {PAYS.map((p) => (
            <i key={p}>{p}</i>
          ))}
        </span>
      </span>
    </Stage>
  );
}

export function TrustGridShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w40}`}>
        <b>Why shop with us</b>
        <span className={s.trustGrid}>
          {BADGES.map(([i, t]) => (
            <span key={t}>
              <i>{i}</i>
              {t}
            </span>
          ))}
        </span>
      </span>
    </Stage>
  );
}

const Pop = ({ k, line, ago }: { k: number; line: string; ago: string }) => (
  <span className={s.salePop}>
    <Img id={PRODUCTS[k].id} w={100} h={100} className={s.salePopImg} />
    <span className={s.pairText}>
      <small>{line}</small>
      <b>{PRODUCTS[k].name}</b>
      <small className={s.muted}>{ago}</small>
    </span>
    <span className={s.salePopX}>×</span>
  </span>
);
export function SalesPopShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w52} ${s.popStage}`}>
        <span className={s.ghostPage}>
          <Lines w={[60, 90, 75]} />
          <Lines w={[85, 50]} />
        </span>
        <Pop k={1} line="Someone in Cairo bought" ago="5 minutes ago" />
      </span>
    </Stage>
  );
}

export function SalesPopStackShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w40}`}>
        <Pop k={0} line="Someone bought" ago="2 minutes ago" />
        <Pop k={3} line="Someone in Giza bought" ago="1 hour ago" />
      </span>
    </Stage>
  );
}

/* ------------------------------------------------------------------- pages -- */
const Field = ({ label, half, tall }: { label: string; half?: boolean; tall?: boolean }) => (
  <span className={`${s.field} ${half ? s.half : ""}`}>
    {label}
    <i className={tall ? s.tall : undefined} />
  </span>
);
const ContactForm = () => (
  <span className={s.form}>
    <Field label="Name" half />
    <Field label="Email *" half />
    <Field label="Phone" />
    <Field label="Message *" tall />
    <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Send message</span>
  </span>
);
export function ContactShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w40}`}>
        <b className={`${s.h2} ${s.centerText}`}>Get in touch</b>
        <Lines w={[80, 55]} />
        <ContactForm />
      </span>
    </Stage>
  );
}
export function ContactInfoShowcase() {
  return (
    <Stage wide>
      <span className={`${s.split} ${s.w56}`}>
        <span className={s.infoPanel}>
          <b>Contact us</b>
          <span className={s.infoRow}>hello@store.com</span>
          <span className={s.infoRow}>+20 100 123 4567</span>
          <span className={s.infoRow}>WhatsApp</span>
          <span className={s.infoRow}>Sat–Thu, 10–8</span>
        </span>
        <span className={`${s.box} ${s.gradBg}`}>
          <b className={s.h3}>Send us a message</b>
          <ContactForm />
        </span>
      </span>
    </Stage>
  );
}
export function ProductPageShowcase() {
  return (
    <Stage wide>
      <span className={`${s.pdp} ${s.w56}`}>
        <Img id={PRODUCTS[0].id} w={500} h={500} />
        <span className={s.plain}>
          <b className={s.h2}>{PRODUCTS[0].name}</b>
          <b className={s.h3}>{PRODUCTS[0].price}</b>
          <Lines w={[95, 85, 60]} />
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
        </span>
      </span>
    </Stage>
  );
}
export function CollectionPageShowcase() {
  return (
    <Stage wide>
      <span className={`${s.plain} ${s.w56}`}>
        <span className={s.between}>
          <b className={s.h3}>New arrivals</b>
          <span className={s.filters}>
            <i>Price</i>
            <i>Size</i>
            <i>Colour</i>
          </span>
        </span>
        <span className={s.coll}>
          {PRODUCTS.slice(0, 4).map((p) => (
            <Img key={p.id} id={p.id} w={300} h={375} />
          ))}
        </span>
      </span>
    </Stage>
  );
}
export function HeaderGlassShowcase() {
  return (
    <Stage wide>
      <span className={s.headerScene}>
        <span className={`${s.navBar} ${s.glass}`}>
          <span>STORE</span>
          <span className={s.navLinks}>
            <span>Shop</span>
            <span>New</span>
            <span>About</span>
          </span>
          <span>Cart (2)</span>
        </span>
        <span className={s.heroText}>Summer collection</span>
      </span>
    </Stage>
  );
}
export function HeaderRoundedShowcase() {
  return (
    <Stage wide>
      <span className={s.headerScene}>
        <span className={`${s.navBar} ${s.roundNav}`}>
          <span>STORE</span>
          <span className={s.navLinks}>
            <span>Shop</span>
            <span>New</span>
            <span>About</span>
          </span>
          <span>Cart (2)</span>
        </span>
        <span className={s.heroText}>New season</span>
      </span>
    </Stage>
  );
}
