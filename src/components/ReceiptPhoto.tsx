"use client";

import { useEffect, useRef, useState } from "react";
import { Button, TextButton } from "./ui";
import { useT } from "./LanguageProvider";

/**
 * The receipt photo on the entry sheet: an "add" button, or the photo's thumbnail (tap to see it
 * large) with buttons to read it with Claude, retake it or remove it.
 */
export function ReceiptPhoto(props: {
  /** address of the photo to show, or null while it loads */
  src: string | null;
  hasPhoto: boolean;
  uploading: boolean;
  reading: boolean;
  /** whether Claude has already read this photo */
  read: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  onRead: () => void;
  later: boolean | null;
  onLater: (later: boolean) => void;
}) {
  const t = useT().receipt;
  const input = useRef<HTMLInputElement>(null);
  const [large, setLarge] = useState(false);
  const pick = () => input.current?.click();

  return (
    <>
      {/* no `capture`: on an iPhone it would only offer the camera, not the photo library */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-label={t.title}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) props.onPick(file);
        }}
      />
      {!props.hasPhoto ? (
        <button type="button" onClick={pick} disabled={props.uploading} className="mt-1 px-1 py-1.5 text-[13px] font-medium text-accent disabled:opacity-50">
          {props.uploading ? t.uploading : t.add}
        </button>
      ) : (
        <section className="mt-2.5 flex gap-2.5 rounded-xl bg-surface-2 p-2.5" aria-label={t.title}>
          <button type="button" onClick={() => setLarge(true)} aria-label={t.open} className="h-20 w-16 flex-none overflow-hidden rounded-lg border border-line bg-bg">
            {props.src && (
              // A signed or local address: next/image can't optimize it.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.src} alt={t.photoAlt} className="size-full object-cover" />
            )}
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
            <Button variant="primary" className="px-3 py-2 text-[13px]" onClick={props.onRead} disabled={props.reading || props.uploading}>
              {props.reading ? t.reading : props.read ? t.readAgain : t.read}
            </Button>
            <div className="flex gap-3 px-1">
              <TextButton onClick={pick} disabled={props.uploading || props.reading}>
                {props.uploading ? t.uploading : t.replace}
              </TextButton>
              <TextButton onClick={props.onRemove} disabled={props.uploading || props.reading} className="text-muted">
                {t.remove}
              </TextButton>
            </div>
            {props.later !== null && (
              <label className="flex items-center gap-1.5 px-1 text-xs">
                <input type="checkbox" checked={props.later} onChange={(e) => props.onLater(e.target.checked)} className="size-4 accent-accent" />
                {t.later}
              </label>
            )}
          </div>
        </section>
      )}
      {large && props.src && <PhotoViewer src={props.src} onClose={() => setLarge(false)} />}
    </>
  );
}

function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const t = useT().receipt;
  useEffect(() => {
    // Escape closes the photo, not the entry sheet behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={t.photoAlt} className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex justify-end p-3 pt-[calc(12px+env(safe-area-inset-top,0px))]">
        <Button onClick={onClose}>{t.close}</Button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={t.photoAlt} className="min-h-0 flex-1 object-contain p-3" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
