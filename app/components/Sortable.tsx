/**
 * Drag to reorder, the same everywhere (FAQ questions, reviews, banners, videos, slides, steps…).
 * Each row gets a grip handle: drag it (mouse, finger or pen), or focus it and use the arrow keys. A line shows where the
 * row will land. `onMove(from, to)` gets the final position; `arrayMove` builds the new list.
 */
import { useRef, useState, type ReactNode } from "react";

export function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type DragApi = {
  start: (index: number, e: React.PointerEvent<HTMLButtonElement>) => void;
};

function Grip({
  label,
  index,
  count,
  onMove,
  drag,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  drag: DragApi;
}) {
  return (
    <button
      type="button"
      aria-label={`Move ${label}. Drag, or use the up and down arrow keys. Position ${index + 1} of ${count}.`}
      title="Drag to reorder"
      onPointerDown={(e) => drag.start(index, e)}
      onKeyDown={(e) => {
        const to =
          e.key === "ArrowUp"
            ? index - 1
            : e.key === "ArrowDown"
              ? index + 1
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? count - 1
                  : null;
        if (to === null) return;
        e.preventDefault();
        if (to >= 0 && to < count && to !== index) onMove(index, to);
      }}
      style={{
        display: "grid",
        placeItems: "center",
        flex: "none",
        width: 28,
        height: 32,
        padding: 0,
        border: 0,
        borderRadius: 6,
        background: "transparent",
        color: "#8a8a8a",
        cursor: "grab",
        touchAction: "none",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f1f1")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true">
        {[3, 9, 15].flatMap((y) =>
          [3, 9].map((x) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r="1.6"
              fill="currentColor"
            />
          )),
        )}
      </svg>
    </button>
  );
}

export function SortableList<T>(props: {
  items: T[];
  keyOf: (item: T, index: number) => string;
  /** Read out with the handle, e.g. the question or the banner name. */
  labelOf: (item: T) => string;
  onMove: (from: number, to: number) => void;
  /** The row; put `handle` where the grip should be (usually first). */
  render: (item: T, index: number, handle: ReactNode) => ReactNode;
  gap?: number;
}) {
  const { items, onMove } = props;
  const list = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null); // insert before this index (items.length = at the end)
  const [said, setSaid] = useState("");
  const move = (from: number, to: number) => {
    onMove(from, to);
    setSaid(
      `${props.labelOf(items[from])} moved to position ${to + 1} of ${items.length}.`,
    );
  };
  /** Where the pointer would drop: before the first row whose middle is below it. */
  const slotAt = (y: number) => {
    const rows = Array.from(
      list.current?.querySelectorAll<HTMLElement>(":scope > [data-sort-row]") ??
        [],
    );
    const i = rows.findIndex((r) => {
      const b = r.getBoundingClientRect();
      return y < b.top + b.height / 2;
    });
    return i < 0 ? rows.length : i;
  };
  const drag: DragApi = {
    start: (index, e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const grip = e.currentTarget;
      grip.setPointerCapture(e.pointerId);
      grip.style.cursor = "grabbing";
      setDragging(index);
      setOver(index);
      let slot = index;
      const moveTo = (ev: PointerEvent) => {
        slot = slotAt(ev.clientY);
        setOver(slot);
      };
      const stop = () => {
        grip.removeEventListener("pointermove", moveTo);
        grip.removeEventListener("pointerup", stop);
        grip.removeEventListener("pointercancel", stop);
        grip.style.cursor = "grab";
        const to = slot > index ? slot - 1 : slot;
        if (to !== index) move(index, to);
        setDragging(null);
        setOver(null);
      };
      grip.addEventListener("pointermove", moveTo);
      grip.addEventListener("pointerup", stop);
      grip.addEventListener("pointercancel", stop);
    },
  };
  const showLine = (slot: number) =>
    dragging !== null &&
    over === slot &&
    slot !== dragging &&
    slot !== dragging + 1;
  return (
    <div
      ref={list}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: props.gap ?? 8,
        userSelect: dragging === null ? undefined : "none",
      }}
    >
      {items.map((item, i) => (
        <div
          key={props.keyOf(item, i)}
          data-sort-row=""
          style={{
            position: "relative",
            opacity: dragging === i ? 0.45 : 1,
            transition: "opacity 0.1s",
          }}
        >
          {showLine(i) ? <DropLine edge="top" /> : null}
          {props.render(
            item,
            i,
            <Grip
              label={props.labelOf(item)}
              index={i}
              count={items.length}
              onMove={move}
              drag={drag}
            />,
          )}
          {i === items.length - 1 && showLine(items.length) ? (
            <DropLine edge="bottom" />
          ) : null}
        </div>
      ))}
      <p
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        {said}
      </p>
    </div>
  );
}

function DropLine({ edge }: { edge: "top" | "bottom" }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [edge]: -5,
        height: 2,
        borderRadius: 2,
        background: "#005bd3",
        zIndex: 2,
      }}
    />
  );
}
