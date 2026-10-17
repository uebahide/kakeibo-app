"use client";

import { useRef, useState } from "react";
import { getCategory } from "@/lib/categories";
import type { Entry } from "@/lib/split";
import { useKakeibo } from "./KakeiboProvider";
import { useT } from "./LanguageProvider";
import { Icons, TxRow, cx } from "./ui";

/**
 * A record (or split payment) in a list that can be swiped left to delete it, as in the history and the
 * home's recent records. The list keeps which row is open, so only one is at a time.
 */
export function SwipeTxRow({
  entry: e,
  showDate = true,
  open,
  onOpen,
}: {
  entry: Entry;
  showDate?: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const { openEntry, deleteRecords, toast } = useKakeibo();
  const t = useT();
  return (
    <SwipeRow
      open={open}
      onOpen={onOpen}
      deleteLabel={t.history.deleteLabel(e.tx.memo || getCategory(e.tx.category).name)}
      onDelete={async () => {
        onOpen(false);
        try {
          await deleteRecords(e.parts);
        } catch {
          toast(t.entry.deleteFailed);
        }
      }}
    >
      <TxRow tx={e.tx} parts={e.parts} showDate={showDate} divider={false} onClick={() => openEntry(e.tx)} />
    </SwipeRow>
  );
}

/** Width of the delete button a swipe uncovers. */
const SWIPE_WIDTH = 80;

/** A row that slides left when swiped (or dragged with a mouse) to show a delete button behind it. */
function SwipeRow({
  open,
  onOpen,
  onDelete,
  deleteLabel,
  children,
}: {
  open: boolean;
  onOpen: (open: boolean) => void;
  onDelete: () => void;
  deleteLabel: string;
  children: React.ReactNode;
}) {
  const start = useRef<{ x: number; y: number; from: number } | null>(null);
  // null: not dragging sideways (yet); a number: the row's offset while it follows the finger
  const [drag, setDrag] = useState<number | null>(null);
  const dragged = useRef(false);
  const offset = drag ?? (open ? -SWIPE_WIDTH : 0);

  return (
    <div className="relative overflow-hidden border-t border-line first:border-t-0">
      <button
        type="button"
        aria-label={deleteLabel}
        // hidden until the row is swiped open (the record's own sheet can delete it too)
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-bad text-bg [&_svg]:size-6"
        style={{ width: SWIPE_WIDTH }}
      >
        {Icons.trash}
      </button>
      <div
        className={cx("relative touch-pan-y bg-surface select-none", drag === null && "transition-transform duration-200 motion-reduce:transition-none")}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY, from: open ? -SWIPE_WIDTH : 0 };
          dragged.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (drag === null) {
            // a mostly vertical move is a scroll, not a swipe
            if (Math.abs(e.clientY - s.y) > Math.abs(dx)) {
              if (Math.abs(e.clientY - s.y) > 8) start.current = null;
              return;
            }
            if (Math.abs(dx) < 8) return;
            dragged.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setDrag(Math.max(-SWIPE_WIDTH, Math.min(0, s.from + dx)));
        }}
        onPointerUp={() => {
          if (drag !== null) onOpen(drag < -SWIPE_WIDTH / 2);
          start.current = null;
          setDrag(null);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        onClickCapture={(e) => {
          // the click that ends a swipe, or a tap on a row swiped open, doesn't open the record
          if (dragged.current || open) {
            e.stopPropagation();
            e.preventDefault();
            if (!dragged.current) onOpen(false);
          }
          dragged.current = false;
        }}
      >
        {children}
      </div>
    </div>
  );
}
