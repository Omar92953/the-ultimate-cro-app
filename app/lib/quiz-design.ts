/**
 * Product finder quiz (Sections → Product quiz): a few questions; each answer points to product tags.
 * The products that match the most chosen tags are recommended, with add to cart, and the answers
 * are saved on the cart ("Quiz: …") so they arrive on the order. Products come from a collection
 * (default: all products, first 250) read on the store. Stored in $app:cro_design "quiz" (+ "_editor").
 */
import { color, num, pick, str } from "./designs";
import { schemeId } from "./theme-style";
import { BUTTON_HEIGHT, BUTTON_TEXT, defaultSizes, sizeVars, withSizes, type SizeSpec, type Sizes } from "./sizes";

export const QUIZ_SIZES: SizeSpec[] = [
  { key: "heading", label: "Heading", cssVar: "--ucs-qz-h", min: 16, max: 56, def: 30 },
  { key: "question", label: "Questions", cssVar: "--ucs-qz-q", min: 14, max: 40, def: 22 },
  { key: "answer", label: "Answers", cssVar: "--ucs-qz-a", min: 11, max: 24, def: 15 },
  BUTTON_TEXT,
  BUTTON_HEIGHT,
];

export type QuizAnswer = { id: string; label: string; tags: string };
export type QuizQuestion = { id: string; text: string; answers: QuizAnswer[] };

export type QuizDesign = {
  scheme: string;
  text: { heading: string; intro: string; start: string; back: string; resultsHeading: string; none: string; add: string; again: string; progress: string };
  questions: QuizQuestion[];
  results: { collection: string; count: number; saveToCart: boolean };
  look: { style: "cards" | "list"; accent: string; onAccent: string; card: string; radius: number; align: "left" | "center" };
  space: { top: number; bottom: number };
  sizes: Sizes;
};

const a = (id: string, label: string, tags: string): QuizAnswer => ({ id, label, tags });
export const DEFAULT_QUIZ: QuizDesign = {
  scheme: "",
  text: {
    heading: "Find your perfect match",
    intro: "Answer 3 quick questions and we'll pick the best products for you.",
    start: "Start the quiz",
    back: "Back",
    resultsHeading: "Our picks for you",
    none: "Nothing matched exactly. Here are our best sellers.",
    add: "Add to cart",
    again: "Take the quiz again",
    progress: "Question {n} of {total}",
  },
  questions: [
    { id: "q1", text: "Who is it for?", answers: [a("a1", "Me", "for-me"), a("a2", "A gift", "gift"), a("a3", "My home", "home")] },
    { id: "q2", text: "What's your style?", answers: [a("a4", "Classic", "classic"), a("a5", "Bold", "bold"), a("a6", "Minimal", "minimal")] },
    { id: "q3", text: "Your budget?", answers: [a("a7", "Under 500", "budget"), a("a8", "500 to 1500", "mid"), a("a9", "Treat yourself", "premium")] },
  ],
  results: { collection: "all", count: 4, saveToCart: true },
  look: { style: "cards", accent: "#121212", onAccent: "#ffffff", card: "#f6f6f6", radius: 12, align: "center" },
  space: { top: 48, bottom: 48 },
  sizes: defaultSizes(QUIZ_SIZES),
};

type Patch = { look?: Partial<QuizDesign["look"]> };
export const QUIZ_PRESETS: { key: string; title: string; patch: Patch }[] = [
  { key: "cards", title: "Answer cards", patch: { look: { style: "cards", accent: "#121212", onAccent: "#ffffff", card: "#f6f6f6", radius: 12, align: "center" } } },
  { key: "list", title: "Simple list", patch: { look: { style: "list", accent: "#121212", onAccent: "#ffffff", card: "#ffffff", radius: 8, align: "left" } } },
  { key: "pastel", title: "Pastel", patch: { look: { style: "cards", accent: "#7c3aed", onAccent: "#ffffff", card: "#f3efff", radius: 18, align: "center" } } },
  { key: "warm", title: "Warm", patch: { look: { style: "cards", accent: "#c2410c", onAccent: "#ffffff", card: "#fff6ea", radius: 14, align: "center" } } },
];

export function applyQuizPreset(c: QuizDesign, key: string): QuizDesign {
  const p = QUIZ_PRESETS.find((x) => x.key === key);
  return p ? { ...c, scheme: "", look: { ...c.look, ...p.patch.look } } : c;
}

const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const tags = (v: unknown) =>
  String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(", ");

export function withQuizDefaults(raw: unknown): QuizDesign {
  const r = obj(raw);
  const d = DEFAULT_QUIZ;
  const t = obj(r.text), re = obj(r.results), k = obj(r.look), s = obj(r.space);
  const T = d.text;
  return {
    scheme: schemeId(r.scheme),
    text: {
      heading: str(t.heading, T.heading, 120),
      intro: str(t.intro, T.intro, 240),
      start: str(t.start, T.start, 40),
      back: str(t.back, T.back, 30),
      resultsHeading: str(t.resultsHeading, T.resultsHeading, 80),
      none: str(t.none, T.none, 160),
      add: str(t.add, T.add, 30),
      again: str(t.again, T.again, 40),
      progress: str(t.progress, T.progress, 60),
    },
    questions: Array.isArray(r.questions)
      ? (r.questions as unknown[]).slice(0, 8).map((x, i) => {
          const q = obj(x);
          return {
            id: str(q.id, `q${i}`, 20) || `q${i}`,
            text: str(q.text, "Question", 160) || "Question",
            answers: (Array.isArray(q.answers) ? (q.answers as unknown[]) : []).slice(0, 8).map((y, j) => {
              const o = obj(y);
              return { id: str(o.id, `a${i}-${j}`, 20) || `a${i}-${j}`, label: str(o.label, "Answer", 60) || "Answer", tags: tags(o.tags) };
            }),
          };
        })
      : d.questions,
    results: {
      collection: String(re.collection ?? d.results.collection).trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "all",
      count: num(re.count, 1, 12, d.results.count),
      saveToCart: bool(re.saveToCart, d.results.saveToCart),
    },
    look: {
      style: pick(k.style, ["cards", "list"] as const, d.look.style),
      accent: color(k.accent, d.look.accent),
      onAccent: color(k.onAccent, d.look.onAccent),
      card: color(k.card, d.look.card),
      radius: num(k.radius, 0, 40, d.look.radius),
      align: pick(k.align, ["left", "center"] as const, d.look.align),
    },
    space: { top: num(s.top, 0, 120, d.space.top), bottom: num(s.bottom, 0, 120, d.space.bottom) },
    sizes: withSizes(r.sizes, QUIZ_SIZES),
  };
}

export function quizVars(c: QuizDesign): Record<string, string> {
  const v: Record<string, string> = {
    "--ucs-pt": `${c.space.top}px`,
    "--ucs-pb": `${c.space.bottom}px`,
    "--ucs-accent": c.look.accent,
    "--ucs-on-accent": c.look.onAccent,
    "--ucs-btn-radius": `${c.look.radius}px`,
    "--ucs-qz-card": c.look.card,
    "--ucs-qz-r": `${c.look.radius}px`,
  };
  Object.assign(v, sizeVars(c.sizes, QUIZ_SIZES));
  return v;
}

export const quizClass = (c: QuizDesign) => `ucs ucs-qz ucs-qz--${c.look.style} ucs-qz--${c.look.align}`;

/** The storefront copy, read by ucs-quiz.liquid / ucs-quiz.js. */
export function toStorefrontQuiz(c: QuizDesign) {
  return {
    cls: quizClass(c),
    css: Object.entries(quizVars(c))
      .map(([k, v]) => `${k}: ${v};`)
      .join(" "),
    t: c.text,
    q: c.questions.map((q) => ({ t: q.text, a: q.answers.map((x) => ({ l: x.label, g: x.tags.split(/,\s*/).filter(Boolean).map((g) => g.toLowerCase()) })) })),
    col: c.results.collection,
    n: c.results.count,
    save: c.results.saveToCart,
  };
}
