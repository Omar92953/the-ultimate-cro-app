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
import { createPortal } from "react-dom";
import { Link } from "react-router";
import s from "./SectionShowcase.module.css";

type Target = { href: string; external?: boolean; /** Opens in a new tab (the live demo). */ newTab?: boolean };

function Go(props: Target & { className: string; children: ReactNode; label?: string }) {
  return props.newTab ? (
    <a className={props.className} href={props.href} target="_blank" rel="noopener noreferrer" aria-label={props.label}>
      {props.children}
    </a>
  ) : props.external ? (
    <a className={props.className} href={props.href} target="_top" aria-label={props.label}>
      {props.children}
    </a>
  ) : (
    <Link className={props.className} to={props.href} prefetch="intent" aria-label={props.label}>
      {props.children}
    </Link>
  );
}

/**
 * The looks of one feature as a small scrolling stage (the same picture as on a hub card, without the
 * card's name and menu): used where a feature is shown but not opened, such as the locked page.
 */
export function PreviewStage(props: { title: string; previews: ReactNode[] }) {
  const [index, setIndex] = useState(0);
  const count = props.previews.length;
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);
  return (
    <div className={s.card} style={{ maxWidth: 560 }}>
      <div className={s.stage}>
        <span className={s.track} style={{ transform: `translateX(-${index * 100}%)` }} role="img" aria-label={`${props.title}, how it looks`}>
          {props.previews.map((preview, i) => (
            <span key={i} className={s.canvas} aria-hidden="true">
              {preview}
            </span>
          ))}
        </span>
        {count > 1 ? (
          <>
            <button type="button" className={`${s.arrow} ${s.arrowPrev}`} aria-label="Previous look" onClick={() => go(-1)}>
              ‹
            </button>
            <button type="button" className={`${s.arrow} ${s.arrowNext}`} aria-label="Next look" onClick={() => go(1)}>
              ›
            </button>
            <span className={s.dots}>
              {props.previews.map((_, i) => (
                <button key={i} type="button" className={`${s.dot} ${i === index ? s.dotOn : ""}`} aria-label={`Look ${i + 1} of ${count}`} aria-current={i === index} onClick={() => setIndex(i)} />
              ))}
            </span>
          </>
        ) : null}
      </div>
    </div>
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
  /** The feature's live demo (a new tab): a small eye link and a menu item. */
  demo?: string;
  /** Bookmark: saved cards are listed under Home → Saved. */
  save?: { saved: boolean; onChange: (saved: boolean) => void };
  /** The detail drawer (the "i" button): what it does and which plan it is on, from the catalog. */
  details?: { about: string; plan: string };
}) {
  const [index, setIndex] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const count = props.previews.length;
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [drawer]);
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
            {props.details ? (
              <button type="button" className={s.iconBtn} aria-label={`Details of ${props.title}`} title="Details" onClick={() => setDrawer(true)}>
                <svg viewBox="0 0 20 20" aria-hidden="true" className={s.dotsIcon}>
                  <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.9 11.5H9.1V9h1.8v4.5ZM10 7.8a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z" fill="currentColor" stroke="none" />
                </svg>
              </button>
            ) : null}
            {props.demo ? (
              <a className={s.iconBtn} href={props.demo} target="_blank" rel="noopener noreferrer" aria-label={`See the live demo of ${props.title} (opens in a new tab)`} title="See live demo">
                <svg viewBox="0 0 20 20" aria-hidden="true" className={s.dotsIcon}>
                  <path d="M10 5C5.5 5 2.7 8.3 2 10c.7 1.7 3.5 5 8 5s7.3-3.3 8-5c-.7-1.7-3.5-5-8-5Zm0 7.8a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z" fill="currentColor" stroke="none" />
                </svg>
              </a>
            ) : null}
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
                    {[...props.menu, ...(props.demo ? [{ label: "See live demo", href: props.demo, newTab: true }] : [])].map((m) =>
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
                          <Go className={s.menuItem} href={m.href} external={m.external} newTab={"newTab" in m ? m.newTab : false}>
                            {m.label}
                            {m.external || ("newTab" in m && m.newTab) ? <span aria-hidden="true"> ↗</span> : null}
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
      {drawer && props.details && typeof document !== "undefined"
        ? createPortal(
            <div className={s.veil} role="presentation" onClick={(e) => e.target === e.currentTarget && setDrawer(false)} onKeyDown={() => {}}>
              <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={props.title}>
                <div className={s.drawerHead}>
                  <strong>{props.title}</strong>
                  <button type="button" className={s.iconBtn} aria-label="Close" onClick={() => setDrawer(false)}>
                    ✕
                  </button>
                </div>
                <div className={s.drawerStage}>
                  <span className={s.track} style={{ transform: `translateX(-${index * 100}%)` }} aria-hidden="true">
                    {props.previews.map((preview, i) => (
                      <span key={i} className={s.canvas}>
                        {preview}
                      </span>
                    ))}
                  </span>
                  {count > 1 ? (
                    <>
                      <button type="button" className={`${s.arrow} ${s.arrowPrev}`} style={{ opacity: 0.9 }} aria-label="Previous look" onClick={() => go(-1)}>
                        ‹
                      </button>
                      <button type="button" className={`${s.arrow} ${s.arrowNext}`} style={{ opacity: 0.9 }} aria-label="Next look" onClick={() => go(1)}>
                        ›
                      </button>
                    </>
                  ) : null}
                </div>
                {count > 1 ? <p className={s.drawerMeta}>Look {index + 1} of {count}</p> : null}
                <p className={s.drawerAbout}>{props.details.about}</p>
                <p className={s.drawerMeta}>{props.details.plan}</p>
                <p className={s.drawerMeta}>
                  <span className={`${s.dotTone} ${s[props.status.tone]}`} aria-hidden="true" /> {props.status.text}
                </p>
                <div className={s.drawerActions}>
                  <Go className={s.drawerPrimary} href={props.open.href} external={props.open.external}>
                    Open
                  </Go>
                  {[...(props.menu ?? []), ...(props.demo ? [{ label: "See live demo", href: props.demo, newTab: true }] : [])].map((m) =>
                    "onClick" in m ? (
                      <button key={m.label} type="button" className={s.drawerLink} onClick={m.onClick}>
                        {m.label}
                      </button>
                    ) : (
                      <Go key={m.label} className={s.drawerLink} href={m.href} external={m.external} newTab={"newTab" in m ? m.newTab : false}>
                        {m.label}
                      </Go>
                    ),
                  )}
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
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

/**
 * For previews drawn in pixels: laid out on a fixed 300 × 190 px canvas (the shape of the card's
 * picture), then scaled as one piece to fill the card — so they keep their look at any card size.
 */
const FIT_W = 300;
const FIT_H = 190;
const Fit = ({ children }: { children: ReactNode }) => {
  const outer = useRef<HTMLSpanElement>(null);
  const [k, setK] = useState<number | null>(null);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => setK(Math.min(el.clientWidth / FIT_W, el.clientHeight / FIT_H));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={outer} className={s.fit}>
      <span className={s.fitCanvas} style={{ width: FIT_W, height: FIT_H, transform: `scale(${k ?? 1})`, opacity: k === null ? 0 : 1 }}>
        {children}
      </span>
    </span>
  );
};

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
        <b className={s.h2}>Hurry, the sale ends soon</b>
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

const SHOTS = [
  { id: PHOTO.yellow, t: "New season", x: "Fresh colours for spring" },
  { id: PHOTO.pink, t: "Everyday basics", x: "Soft cotton, easy fits" },
  { id: PHOTO.sunny, t: "Weekend edit", x: "Made for slow days" },
  { id: PHOTO.shopper, t: "Gift ideas", x: "Something for everyone" },
];
/** Image carousel: pictures with a title and text underneath, arrows and dots. */
export function ImageCarouselShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.center} ${s.w52}`}>
        <b className={s.h3}>Shop the look</b>
        <span className={s.icRow}>
          {SHOTS.map((x) => (
            <span key={x.id} className={s.icSlide}>
              <Img id={x.id} w={260} h={325} className={s.icImg} />
              <b>{x.t}</b>
              <small className={s.muted}>{x.x}</small>
            </span>
          ))}
          <span className={`${s.icArrow} ${s.icPrev}`}>‹</span>
          <span className={`${s.icArrow} ${s.icNext}`}>›</span>
        </span>
        <span className={s.icDots}>
          <i className={s.icDotOn} />
          <i />
          <i />
        </span>
      </span>
    </Stage>
  );
}

/** Image carousel: bigger pictures with the title and a button on the picture. */
export function ImageCarouselOverlayShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w52}`}>
        <span className={`${s.icRow} ${s.icRow3}`}>
          {SHOTS.slice(0, 3).map((x) => (
            <span key={x.id} className={`${s.icSlide} ${s.icOver}`}>
              <Img id={x.id} w={300} h={300} className={s.icImg} />
              <span className={s.icCap}>
                <b>{x.t}</b>
                <span className={`${s.btn} ${s.btnSm} ${s.icBtn}`}>Shop now</span>
              </span>
            </span>
          ))}
        </span>
      </span>
    </Stage>
  );
}

const ADDONS = [
  { t: "Gift wrapping", x: "Wrapped by hand in recycled paper", p: "+$5.00", on: true, id: "1513885535751-8b9238bd345a" },
  { t: "Greeting card", x: "Your message, handwritten", p: "+$3.00", on: false, id: "1607344645866-009c320b63e0" },
  { t: "2-year warranty", x: "Repairs and replacements", p: "+$12.00", on: false, id: PRODUCTS[1].id },
];
/** Add-ons: one tick box (gift wrapping) under the Add to cart button. */
export function AddonsShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w40}`}>
        <span className={s.between}>
          <b className={s.h3}>Classic watch</b>
          <b>$129</b>
        </span>
        <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
        <b>Make it extra special</b>
        <span className={s.aoList}>
          {ADDONS.slice(0, 1).map((a) => (
            <span key={a.t} className={`${s.aoItem} ${a.on ? s.aoOn : ""}`}>
              <span className={`${s.aoBox} ${a.on ? s.aoBoxOn : ""}`}>{a.on ? "✓" : ""}</span>
              <Img id={a.id} w={80} h={80} className={s.aoImg} />
              <span className={s.aoBody}>
                <b>{a.t}</b>
                <small className={s.muted}>{a.x}</small>
              </span>
              <b>{a.p}</b>
            </span>
          ))}
        </span>
      </span>
    </Stage>
  );
}

/** Add-ons as cards side by side, with the gift message open. */
export function AddonsCardsShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.w46}`}>
        <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Add to cart</span>
        <span className={s.aoCards}>
          {ADDONS.map((a) => (
            <span key={a.t} className={`${s.aoItem} ${s.aoCard} ${a.on ? s.aoOn : ""}`}>
              <Img id={a.id} w={80} h={80} className={s.aoImg} />
              <b>{a.t}</b>
              <small className={s.muted}>{a.p}</small>
              <span className={`${s.aoBox} ${s.aoCorner} ${a.on ? s.aoBoxOn : ""}`}>{a.on ? "✓" : ""}</span>
            </span>
          ))}
        </span>
        <span className={`${s.aoItem} ${s.aoOn}`}>
          <span className={`${s.aoBox} ${s.aoBoxOn}`}>✓</span>
          <b>Add a gift message</b>
        </span>
        <span className={s.aoMsg}>Happy birthday Sara! Love, Omar</span>
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
          <b className={s.h3}>Flash sale: 40% off</b>
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
const PILLS = ["All", "Eighties", "Anime", "Cartoon", "Colors", "Comics", "Football"];
/** Collection pills: outline pills under a collection title, the current one filled. */
export function CollectionPillsShowcase() {
  return (
    <Stage>
      <span className={`${s.plain} ${s.center} ${s.w56}`}>
        <b className={`${s.h3} ${s.cpTitle}`}>All single stickers</b>
        <span className={s.cpRow}>
          {PILLS.map((p, i) => (
            <span key={p} className={`${s.cpPill} ${i === 0 ? s.cpOn : ""}`}>
              {p}
            </span>
          ))}
        </span>
        <small className={s.muted}>3,992 products</small>
      </span>
    </Stage>
  );
}

/** Collection pills with pictures, soft style. */
export function CollectionPillsImagesShowcase() {
  const pics = [PHOTO.yellow, PHOTO.pink, PHOTO.sunny, PHOTO.shopper, PRODUCTS[0].id];
  return (
    <Stage>
      <span className={`${s.plain} ${s.center} ${s.w56}`}>
        <span className={s.cpRow}>
          {["New in", "Dresses", "Tops", "Shoes", "Bags"].map((p, i) => (
            <span key={p} className={`${s.cpPill} ${s.cpSoft} ${i === 2 ? s.cpOn : ""}`}>
              <Img id={pics[i]} w={60} h={60} className={s.cpImg} />
              {p}
            </span>
          ))}
        </span>
      </span>
    </Stage>
  );
}

/** Free shipping bar inside the cart drawer: what's left to spend, above the items. */
export function ShippingBarCartShowcase() {
  return (
    <span className={s.fsbCartScene}>
      <span className={s.fsbShade}>
        <Lines w={[30, 80, 65, 72, 40]} />
      </span>
      <span className={s.fsbPanel}>
        <span className={s.between}>
          <b className={s.h3}>Your cart</b>
          <span className={s.muted}>2 items</span>
        </span>
        <span className={s.fsbIn}>
          <span>🚚 You&rsquo;re $28 away from free shipping</span>
          <i className={s.fsbTrack}>
            <i style={{ width: "86%" }} />
          </i>
        </span>
        {[PRODUCTS[1], PRODUCTS[3]].map((p) => (
          <span key={p.id} className={s.fsbItem}>
            <Img id={p.id} w={120} h={120} />
            <span>
              <b>{p.name}</b>
              <span className={s.muted}>Qty 1</span>
            </span>
            <b>{p.price}</b>
          </span>
        ))}
        <span className={s.fsbFoot}>
          <span className={s.between}>
            <span>Subtotal</span>
            <b>$174</b>
          </span>
          <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Check out</span>
        </span>
      </span>
    </span>
  );
}

/** Free shipping bar: message and a progress line filling up. */
export function ShippingBarShowcase() {
  return (
    <Stage wide>
      <span className={s.fsbScene}>
        <span className={s.fsbBar}>
          <span>🚚 You&rsquo;re $28 away from free shipping</span>
          <i className={s.fsbTrack}>
            <i style={{ width: "72%" }} />
          </i>
        </span>
        <span className={s.fsbPage}>
          <Lines w={[40, 70, 55]} />
        </span>
      </span>
    </Stage>
  );
}

/** Free shipping bar as a card inside the cart drawer, goal reached. */
export function ShippingBarCardShowcase() {
  return (
    <Stage>
      <span className={`${s.box} ${s.w40} ${s.fsbDrawer}`}>
        <b className={s.h3}>Your cart</b>
        <span className={s.fsbCard}>
          <span>🎉 You&rsquo;ve got free shipping!</span>
          <i className={`${s.fsbTrack} ${s.fsbDone}`}>
            <i style={{ width: "100%" }} />
          </i>
        </span>
        <span className={s.between}>
          <span>Classic watch</span>
          <b>$129</b>
        </span>
        <span className={`${s.btn} ${s.btnDark} ${s.full}`}>Check out</span>
      </span>
    </Stage>
  );
}

/** Product page reviews: a product page with the star rating line and the snippet card next to Add to cart. */
export function ProductReviewsShowcase() {
  const gold = "#f5a623";
  return (
    <Fit>
      <span style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 14, width: "100%", alignItems: "center", fontSize: 11 }}>
        <span style={{ aspectRatio: "1", borderRadius: 8, background: "linear-gradient(145deg,#e9e9e9,#cfcfcf)" }} />
        <span style={{ display: "grid", gap: 6 }}>
          <b style={{ fontSize: 14 }}>Classic tee</b>
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ color: gold, letterSpacing: 1 }}>★★★★★</span>
            <b>4.8</b>
            <span style={{ textDecoration: "underline", opacity: 0.7 }}>12 reviews</span>
          </span>
          <b>EGP 450.00</b>
          <span style={{ display: "flex", gap: 8, alignItems: "center", padding: 7, borderRadius: 10, background: "#f4f4f4" }}>
            <span style={{ width: 34, height: 34, flex: "none", borderRadius: 6, background: "linear-gradient(145deg,#3b3b3b,#111)" }} />
            <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
              <span style={{ color: gold, fontSize: 9, letterSpacing: 1 }}>★★★★★</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Perfect fit!</span>
              <b style={{ fontSize: 9 }}>Mariam A. <span style={{ color: "#1a7f37" }}>✔</span></b>
            </span>
          </span>
          <span style={{ display: "block", padding: "7px 0", borderRadius: 999, background: "#111", color: "#fff", textAlign: "center", fontWeight: 600 }}>Add to cart</span>
        </span>
      </span>
    </Fit>
  );
}

/** Back in stock & pre-order: a sold-out product with the "Notify me" box under the button. */
export function StockShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 14, width: "100%", alignItems: "center", fontSize: 11 }}>
        <span style={{ aspectRatio: "1", borderRadius: 8, background: "linear-gradient(145deg,#e9e9e9,#cfcfcf)" }} />
        <span style={{ display: "grid", gap: 6 }}>
          <b style={{ fontSize: 14 }}>Linen shirt</b>
          <b>EGP 650.00</b>
          <span style={{ display: "block", padding: "7px 0", borderRadius: 999, background: "#e5e5e5", color: "#777", textAlign: "center", fontWeight: 600 }}>Sold out</span>
          <span style={{ display: "grid", gap: 5, padding: 8, borderRadius: 10, background: "#f4f4f4" }}>
            <b>Get an email when it’s back</b>
            <span style={{ display: "flex", gap: 5 }}>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", padding: "5px 7px", borderRadius: 6, background: "#fff", border: "1px solid #ddd", color: "#999" }}>Email</span>
              <span style={{ flex: "none", whiteSpace: "nowrap", padding: "5px 9px", borderRadius: 6, background: "#111", color: "#fff", fontWeight: 600 }}>Notify me</span>
            </span>
          </span>
        </span>
      </span>
    </Fit>
  );
}

/** Track order page: the lookup card with a found order's status and tracking. */
export function TrackShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 6, width: "62%", padding: 12, borderRadius: 12, background: "#f4f4f4", fontSize: 11, textAlign: "center" }}>
        <b style={{ fontSize: 15 }}>#1001</b>
        <span style={{ display: "flex", gap: 5, justifyContent: "center" }}>
          <span style={{ padding: "2px 8px", borderRadius: 999, background: "#111", color: "#fff", fontWeight: 600 }}>Shipped</span>
          <span style={{ padding: "2px 8px", borderRadius: 999, background: "#ddd" }}>Paid</span>
        </span>
        <span>Tracking number: <b>EG123456789</b></span>
        <span style={{ padding: "5px 0", borderRadius: 999, border: "1px solid #111", fontWeight: 600 }}>Track the parcel</span>
      </span>
    </Fit>
  );
}

/** Returns page: choosing items and a reason. */
export function ReturnsShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 6, width: "62%", padding: 12, borderRadius: 12, background: "#f4f4f4", fontSize: 11 }}>
        <b style={{ fontSize: 14 }}>Request a return</b>
        {["Linen shirt · M", "Classic tee · L"].map((t, i) => (
          <span key={t} style={{ display: "flex", gap: 6, alignItems: "center", padding: 5, borderRadius: 8, background: "#fff" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, border: "1.5px solid #111", background: i === 0 ? "#111" : "transparent" }} />
            <span style={{ width: 20, height: 20, borderRadius: 5, background: "#ddd" }} />
            {t}
          </span>
        ))}
        <span style={{ padding: "5px 7px", borderRadius: 6, background: "#fff", border: "1px solid #ddd" }}>Wrong size ▾</span>
        <span style={{ padding: "5px 0", borderRadius: 999, background: "#111", color: "#fff", textAlign: "center", fontWeight: 600 }}>Send return request</span>
      </span>
    </Fit>
  );
}

/** Delivery estimate: the green line under Add to cart. */
export function DeliveryShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 8, width: "70%", fontSize: 11 }}>
        <b style={{ fontSize: 14 }}>Classic tee</b>
        <b>EGP 450.00</b>
        <span style={{ display: "block", padding: "7px 0", borderRadius: 999, background: "#111", color: "#fff", textAlign: "center", fontWeight: 600 }}>Add to cart</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: "#f3f8f4" }}>
          <span style={{ color: "#1a7f37", fontSize: 14 }}>🚚</span>
          <span>
            Order within <b style={{ color: "#1a7f37" }}>2h 15m</b> and get it <b>Thu, Oct 15 to Sun, Oct 18</b>
          </span>
        </span>
      </span>
    </Fit>
  );
}

/** Personalization: a name field with the text drawn on the product picture. */
export function PersonalizeShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 12, width: "86%", alignItems: "center", fontSize: 11 }}>
        <span style={{ position: "relative", aspectRatio: "1", borderRadius: 8, background: "linear-gradient(145deg,#3b3b3b,#111)", display: "grid", placeItems: "center", color: "#fff", fontFamily: "Georgia, serif", fontSize: 16, letterSpacing: 1 }}>MARIAM</span>
        <span style={{ display: "grid", gap: 6, padding: 8, borderRadius: 8, background: "#f4f4f4" }}>
          <b>Make it yours</b>
          <span>Name to engrave</span>
          <span style={{ padding: "5px 7px", borderRadius: 6, background: "#fff", border: "1px solid #ddd" }}>Mariam</span>
          <span style={{ display: "block", padding: "6px 0", borderRadius: 999, background: "#111", color: "#fff", textAlign: "center", fontWeight: 600 }}>Add to cart</span>
        </span>
      </span>
    </Fit>
  );
}

/** Gift note & delivery date: the cart box with the gift tick, message and date. */
export function CartExtrasShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 6, width: "72%", padding: 10, borderRadius: 10, background: "#f4f4f4", fontSize: 11 }}>
        <b>Gift and delivery</b>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: "#111" }} /> This is a gift
        </span>
        <span style={{ padding: "6px 7px", borderRadius: 6, background: "#fff", border: "1px solid #ddd", color: "#777" }}>Happy birthday, Nour!</span>
        <span style={{ display: "flex", gap: 6 }}>
          <span style={{ flex: 1, whiteSpace: "nowrap", padding: "5px 7px", borderRadius: 6, background: "#fff", border: "1px solid #ddd" }}>Thu, Oct 15 ▾</span>
          <span style={{ flex: 1, whiteSpace: "nowrap", padding: "5px 7px", borderRadius: 6, background: "#fff", border: "1px solid #ddd" }}>2 to 6 pm ▾</span>
        </span>
      </span>
    </Fit>
  );
}

/** Wishlist: product cards with hearts and the floating count. */
export function WishlistShowcase() {
  return (
    <Fit>
      <span style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, width: "88%", marginBottom: 24, fontSize: 10 }}>
        {["Linen shirt", "Classic tee", "Canvas tote"].map((t, i) => (
          <span key={t} style={{ display: "grid", gap: 3 }}>
            <span style={{ position: "relative", aspectRatio: "1", borderRadius: 6, background: ["#e5e5e5", "#d8dee8", "#efe7da"][i] }}>
              <span style={{ position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, background: "#fff", display: "grid", placeItems: "center", color: "#e11d48", fontSize: 11 }}>{i !== 1 ? "♥" : "♡"}</span>
            </span>
            <b>{t}</b>
          </span>
        ))}
        <span style={{ position: "absolute", left: 0, bottom: -30, padding: "3px 8px", borderRadius: 999, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,.15)", color: "#e11d48" }}>
          ♥ <b style={{ color: "#111" }}>2</b>
        </span>
      </span>
    </Fit>
  );
}

/** Product quiz: a question with answer cards and progress. */
export function QuizShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 7, justifyItems: "center", width: "76%", fontSize: 11, textAlign: "center" }}>
        <span style={{ opacity: 0.7 }}>Question 2 of 3</span>
        <span style={{ width: "60%", height: 4, borderRadius: 4, background: "#ddd" }}>
          <span style={{ display: "block", width: "33%", height: 4, borderRadius: 4, background: "#111" }} />
        </span>
        <b style={{ fontSize: 14 }}>What&apos;s your style?</b>
        <span style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, width: "100%" }}>
          {["Classic", "Bold", "Minimal"].map((t, i) => (
            <span key={t} style={{ padding: "10px 0", borderRadius: 8, background: "#f4f4f4", border: i === 1 ? "2px solid #111" : "2px solid transparent", fontWeight: 600 }}>{t}</span>
          ))}
        </span>
      </span>
    </Fit>
  );
}

/** A checkout list (payment methods or delivery options) with one row changed by a rule. */
const CheckoutList = ({ title, rows }: { title: string; rows: { label: string; note?: string; hidden?: boolean; on?: boolean }[] }) => (
  <Fit>
    <span style={{ display: "grid", gap: 6, width: "100%", fontSize: 11 }}>
      <b style={{ fontSize: 13 }}>{title}</b>
      {rows.map((r) => (
        <span
          key={r.label}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, border: `1px solid ${r.on ? "#111" : "#ddd"}`, background: "#fff", opacity: r.hidden ? 0.35 : 1, textDecoration: r.hidden ? "line-through" : "none" }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 999, border: "1.5px solid #111", background: r.on ? "#111" : "transparent", flex: "none" }} />
          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
          {r.note ? <span style={{ flex: "none", whiteSpace: "nowrap", fontSize: 9, padding: "2px 6px", borderRadius: 999, background: r.hidden ? "#fde8e8" : "#e8f5ec", color: r.hidden ? "#b42318" : "#1a7f37", textDecoration: "none" }}>{r.note}</span> : null}
        </span>
      ))}
    </span>
  </Fit>
);

/** Payment rules: Cash on Delivery hidden on a large order. */
export function PaymentRulesShowcase() {
  return <CheckoutList title="Payment" rows={[{ label: "Credit card", on: true }, { label: "Cash on Delivery", hidden: true, note: "Hidden over 5,000" }, { label: "Bank transfer" }]} />;
}

/** Delivery rules: an option renamed, another hidden. */
export function DeliveryRulesShowcase() {
  return <CheckoutList title="Shipping method" rows={[{ label: "Free delivery, 2 to 3 days", on: true, note: "Renamed" }, { label: "Express", hidden: true, note: "Hidden: fragile item" }, { label: "Local pickup" }]} />;
}

/** Order limits: checkout blocked with the merchant's message. */
export function OrderLimitsShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 8, width: "76%", fontSize: 11 }}>
        <b style={{ fontSize: 13 }}>Checkout</b>
        <span style={{ padding: "8px 10px", borderRadius: 8, background: "#fdecea", color: "#8a1c12", border: "1px solid #f5c2bd" }}>The minimum order is EGP 300. Add EGP 75 more to continue.</span>
        <span style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span>
          <b>EGP 225.00</b>
        </span>
        <span style={{ display: "block", padding: "8px 0", borderRadius: 8, background: "#9ca3af", color: "#fff", textAlign: "center", fontWeight: 600 }}>Pay now</span>
      </span>
    </Fit>
  );
}

/** Thank-you page: the confirmation with a next-order code and products. */
export function ThankYouShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 7, width: "76%", fontSize: 11 }}>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 18, height: 18, borderRadius: 999, border: "1.5px solid #1a7f37", color: "#1a7f37", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700 }}>✓</span>
          <b style={{ fontSize: 13 }}>Thank you, Mariam!</b>
        </span>
        <span style={{ display: "grid", gap: 5, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}>
          <b>A thank-you gift: 10% off your next order</b>
          <span style={{ display: "flex", gap: 6 }}>
            <span style={{ padding: "3px 8px", border: "1px dashed #999", borderRadius: 5, fontWeight: 700, letterSpacing: 1 }}>THANKS10</span>
            <span style={{ padding: "3px 8px", border: "1px solid #ccc", borderRadius: 5, fontWeight: 600 }}>Copy code</span>
          </span>
        </span>
        <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {["#e9e2d8", "#dfe7ef", "#e7e0ee"].map((c) => (
            <span key={c} style={{ aspectRatio: "1", borderRadius: 6, background: c }} />
          ))}
        </span>
      </span>
    </Fit>
  );
}

/** After-purchase offer: one product at a discount, added to the paid order in one click. */
export function PostPurchaseShowcase() {
  return (
    <Fit>
      <span style={{ display: "grid", gap: 7, width: "80%", fontSize: 11 }}>
        <span style={{ padding: "6px 8px", borderRadius: 6, background: "#f1f6fe", border: "1px solid #c7dbf7", textAlign: "center" }}>
          <b>Wait, add this to your order</b>
        </span>
        <span style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 8, alignItems: "center" }}>
          <span style={{ aspectRatio: "1", borderRadius: 6, background: "#e9e2d8" }} />
          <span style={{ display: "grid", gap: 4 }}>
            <b>Travel case</b>
            <span>
              <s style={{ color: "#777" }}>EGP 300</s> <b style={{ color: "#b42318" }}>EGP 255</b>
            </span>
            <span style={{ display: "block", padding: "5px 0", borderRadius: 5, background: "#1773b0", color: "#fff", textAlign: "center", fontWeight: 600 }}>Pay now · EGP 255</span>
            <span style={{ textAlign: "center", color: "#1773b0" }}>Decline this offer</span>
          </span>
        </span>
      </span>
    </Fit>
  );
}
