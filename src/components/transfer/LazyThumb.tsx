import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Film } from 'lucide-react';
import { getReceivedRecord } from '../../utils/transferReceivedStore';
import { getThumbFor, getThumbnail, peekThumbFor, peekThumbnail, type ThumbKind } from '../../utils/transferThumbs';

interface Props {
  /** Stable cache key: an attachment's id, or name + size + date for a picked File. */
  thumbKey: string;
  kind: ThumbKind;
  /** What the preview is made from, only when it is needed: a File / Blob, or an address. */
  source: Blob | string | null | undefined;
  /** A file kept in Received files: its preview is cached on disk too. */
  receivedId?: string;
  /** Longest side of the preview, px. */
  size?: number;
  iconSize?: number;
  className?: string;
  fit?: 'cover' | 'contain';
}

const isStored = (id?: string) => !!id && getReceivedRecord(id)?.status === 'complete';

/**
 * A picture or video shown as a small preview, made only once it comes near the screen. The full
 * file is never decoded here - it is read when someone opens it. Fills its (sized) parent.
 */
export function LazyThumb({ thumbKey, kind, source, receivedId, size = 256, iconSize = 20, className = '', fit = 'cover' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const peek = () => (isStored(receivedId) ? peekThumbnail(receivedId!) : peekThumbFor(thumbKey, size));
  const [url, setUrl] = useState<string | null | undefined>(peek);
  const [near, setNear] = useState(false);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // Near the screen (with a margin, so previews are ready as they scroll in).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hasSource = !!source || isStored(receivedId);
  useEffect(() => {
    const known = peek();
    if (known !== undefined) {
      setUrl(known);
      return;
    }
    if (!near || !hasSource) return;
    let live = true;
    const stillWanted = () => live;
    const job = isStored(receivedId)
      ? getThumbnail(receivedId!, stillWanted)
      : getThumbFor(
          thumbKey,
          kind,
          async () => {
            const src = sourceRef.current;
            if (!src) return null;
            if (src instanceof Blob) return src;
            const res = await fetch(src);
            return res.ok ? res.blob() : null;
          },
          stillWanted,
          size,
        );
    job.then((u) => {
      if (live && u !== undefined) setUrl(u);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, thumbKey, receivedId, kind, size, hasSource]);

  const Icon = kind === 'video' ? Film : ImageIcon;
  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden flex items-center justify-center ${className}`}>
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          className={`absolute inset-0 w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <>
          {url === undefined && hasSource && <div className="absolute inset-0 animate-pulse bg-current opacity-[0.07]" />}
          <Icon size={iconSize} className="relative opacity-50" />
        </>
      )}
    </div>
  );
}
