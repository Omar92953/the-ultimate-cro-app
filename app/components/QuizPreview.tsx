/** Live preview of the product quiz: click through the questions (the results show sample products). */
import { useState, type CSSProperties } from "react";
import { quizClass, quizVars, type QuizDesign } from "../lib/quiz-design";

const SAMPLE = [
  { title: "Linen shirt", price: "EGP 650", bg: "#e5e5e5" },
  { title: "Classic tee", price: "EGP 450", bg: "#d8dee8" },
  { title: "Canvas tote", price: "EGP 300", bg: "#efe7da" },
  { title: "Wool scarf", price: "EGP 520", bg: "#e7e0f0" },
];

export function QuizPreview({ config: c, startAt = -1 }: { config: QuizDesign; startAt?: number }) {
  const [step, setStep] = useState(startAt);
  const t = c.text;
  const q = c.questions[step];
  const done = step >= c.questions.length;
  return (
    <div className={quizClass(c)} style={quizVars(c) as CSSProperties}>
      <div className="ucs-wrap ucs-qz__wrap">
        {step < 0 ? (
          <>
            <h2 className="ucs-qz__h">{t.heading}</h2>
            {t.intro ? <p className="ucs-qz__intro">{t.intro}</p> : null}
            <button type="button" className="ucs-btn" onClick={() => setStep(0)}>
              {t.start}
            </button>
          </>
        ) : done ? (
          <>
            <h2 className="ucs-qz__h">{t.resultsHeading}</h2>
            <ul className="ucs-qz__grid">
              {SAMPLE.slice(0, c.results.count).map((p) => (
                <li key={p.title} className="ucs-qz__item">
                  <span className="ucs-qz__ph" style={{ background: p.bg }} />
                  <b>{p.title}</b>
                  <span>{p.price}</span>
                  <button type="button" className="ucs-btn">
                    {t.add}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="ucs-qz__back" onClick={() => setStep(-1)}>
              {t.again}
            </button>
          </>
        ) : q ? (
          <>
            <p className="ucs-qz__progress">{t.progress.replace("{n}", String(step + 1)).replace("{total}", String(c.questions.length))}</p>
            <span className="ucs-qz__bar">
              <i style={{ width: `${Math.round((step / c.questions.length) * 100)}%` }} />
            </span>
            <h2 className="ucs-qz__q">{q.text}</h2>
            <div className="ucs-qz__answers">
              {q.answers.map((a) => (
                <button key={a.id} type="button" className="ucs-qz__a" onClick={() => setStep(step + 1)}>
                  {a.label}
                </button>
              ))}
            </div>
            {step > 0 ? (
              <button type="button" className="ucs-qz__back" onClick={() => setStep(step - 1)}>
                {t.back}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
