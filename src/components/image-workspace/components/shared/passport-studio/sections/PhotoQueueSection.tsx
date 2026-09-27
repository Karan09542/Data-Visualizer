import React from 'react';
import { GripVertical, Images, Plus, Scale, Trash2, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileDropzoneUpload } from '../../../../../utilities/FileDropzoneUpload';
import { QUANTITY_PRESETS } from '../constants';
import type { PhotoQueueItem } from '../types';
import { Button, Chip, ChipRow, FieldLabel, NumberInput, SettingsCard, cx } from '../ui/primitives';

type SetQueue = React.Dispatch<React.SetStateAction<PhotoQueueItem[]>>;

/**
 * Splits the sheet's slots across photos as evenly as possible; earlier photos take the remainder
 * (20 slots / 3 photos -> 7, 7, 6). Every photo keeps at least 1 copy, since quantity is never 0.
 */
function distributeEvenly(slots: number, count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(slots / count);
  const remainder = slots % count;
  return Array.from({ length: count }, (_, i) => Math.max(1, base + (i < remainder ? 1 : 0)));
}

/** '7 + 7 + 6', or '5 × 4' when every photo gets the same count. */
function formatSplit(counts: number[]): string {
  if (counts.length === 0) return '';
  return counts.every(c => c === counts[0]) ? `${counts[0]} × ${counts.length}` : counts.join(' + ');
}

const SortablePhotoItem: React.FC<{
  item: PhotoQueueItem;
  idx: number;
  setPhotoQueue: SetQueue;
}> = ({ item, idx, setPhotoQueue }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx(
        'flex items-center gap-2.5 p-1.5 pr-2 rounded-lg border transition-shadow',
        'bg-white border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.06]',
        isDragging && 'shadow-lg ring-1 ring-blue-500/40',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        title="Drag to reorder"
        className="cursor-grab active:cursor-grabbing touch-none p-1 rounded text-slate-400 hover:text-slate-700 dark:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
      >
        <GripVertical size={14} />
      </button>
      <div className="w-9 h-11 rounded-md overflow-hidden shrink-0 bg-slate-100 dark:bg-white/5 relative">
        <img src={item.src} alt={`Photo ${idx + 1}`} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate text-slate-800 dark:text-zinc-200">Photo {idx + 1}</div>
        <div className="text-[10px] text-slate-500 dark:text-zinc-500 mt-0.5">{item.quantity} {item.quantity === 1 ? 'copy' : 'copies'}</div>
      </div>
      <div onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-1 shrink-0">
        <NumberInput
          min="1"
          max="1000"
          value={item.quantity}
          title="Print Quantity"
          className="w-16 h-8"
          inputClassName="text-center px-1"
          onValueChange={(raw) => {
            const val = Math.max(1, parseInt(raw) || 1);
            setPhotoQueue(prev => prev.map(p => p.id === item.id ? { ...p, quantity: val } : p));
          }}
        />
        <button
          type="button"
          onClick={() => setPhotoQueue(prev => prev.filter(p => p.id !== item.id))}
          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
          title="Remove Photo"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export const PhotoQueueSection: React.FC<{
  photoQueue: PhotoQueueItem[];
  setPhotoQueue: SetQueue;
  maxCapacity: number;
  onClearAll: () => void;
  onAddPhoto: () => void;
  onFileSelected: (file: File) => void;
}> = ({ photoQueue, setPhotoQueue, maxCapacity, onClearAll, onAddPhoto, onFileSelected }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over?.id) {
      setPhotoQueue((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const single = photoQueue.length === 1;
  const totalCopies = photoQueue.reduce((acc, p) => acc + p.quantity, 0);
  const overflow = Math.max(0, totalCopies - maxCapacity);
  const evenCounts = distributeEvenly(maxCapacity, photoQueue.length);
  const isAlreadyEven = photoQueue.every((p, i) => p.quantity === evenCounts[i]);

  const handleDistribute = () => {
    setPhotoQueue(prev => {
      const counts = distributeEvenly(maxCapacity, prev.length);
      return prev.map((p, i) => ({ ...p, quantity: counts[i] }));
    });
  };

  return (
    <SettingsCard
      icon={<Images size={15} />}
      title={single ? 'Photo quantity' : 'Photo queue'}
      description={single ? 'How many copies to place on the sheet' : 'Drag to reorder, set copies per photo'}
      aside={
        <div className="flex items-center gap-1">
          {photoQueue.length > 0 && (
            <Button variant="danger" size="sm" onClick={onClearAll} title="Remove all photos" icon={<Trash2 size={12} />}>
              <span className="sr-only sm:not-sr-only">Clear</span>
            </Button>
          )}
          <Button variant="accent" size="sm" onClick={onAddPhoto} icon={<Plus size={13} />}>
            Add
          </Button>
        </div>
      }
    >
      {single ? (
        <>
          <ChipRow>
            <Chip
              active={photoQueue[0].quantity === maxCapacity}
              onClick={() => setPhotoQueue([{ ...photoQueue[0], quantity: maxCapacity }])}
            >
              Fill sheet
            </Chip>
            {QUANTITY_PRESETS.map((val) => (
              <Chip
                key={val}
                active={photoQueue[0].quantity === val}
                onClick={() => setPhotoQueue([{ ...photoQueue[0], quantity: val }])}
              >
                {val}
              </Chip>
            ))}
          </ChipRow>

          <div>
            <FieldLabel aside={<span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">max {maxCapacity}</span>}>
              Custom quantity
            </FieldLabel>
            <NumberInput
              min="1" max={Math.max(1, maxCapacity)}
              value={photoQueue[0].quantity}
              suffix="copies"
              onValueChange={raw => {
                const val = Math.max(1, parseInt(raw) || 1);
                setPhotoQueue([{ ...photoQueue[0], quantity: val }]);
              }}
            />
          </div>
        </>
      ) : (
        <>
        {photoQueue.length > 1 && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-slate-50 border-slate-200 dark:bg-black/20 dark:border-white/[0.06]">
            <div className="min-w-0">
              <div className="text-xs font-medium tabular-nums text-slate-800 dark:text-zinc-200">
                {Math.min(totalCopies, maxCapacity)} of {maxCapacity} slots used
              </div>
              <div className={cx(
                'text-[11px] mt-0.5 truncate',
                overflow > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-zinc-500',
              )}>
                {overflow > 0
                  ? `${overflow} ${overflow === 1 ? 'copy doesn’t' : 'copies don’t'} fit on the sheet`
                  : `Even split: ${formatSplit(evenCounts)}`}
              </div>
            </div>
            <Button
              variant={isAlreadyEven ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleDistribute}
              disabled={maxCapacity === 0 || isAlreadyEven}
              title={`Fill the sheet with an equal number of copies of each photo (${formatSplit(evenCounts)})`}
              icon={<Scale size={13} />}
            >
              {isAlreadyEven ? 'Evenly split' : 'Distribute equally'}
            </Button>
          </div>
        )}
        <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar -mr-1 pr-1">
          {photoQueue.length === 0 && (
            <FileDropzoneUpload
              onFileSelected={onFileSelected}
              accept="image/*"
              title="Queue is empty"
              subtitle="Drop photo, paste from clipboard or snap camera"
              accentColor="blue"
              enableCamera={true}
              className="w-full text-xs"
            />
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={photoQueue.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {photoQueue.map((item, idx) => (
                <SortablePhotoItem
                  key={item.id}
                  item={item}
                  idx={idx}
                  setPhotoQueue={setPhotoQueue}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        </>
      )}
    </SettingsCard>
  );
};
