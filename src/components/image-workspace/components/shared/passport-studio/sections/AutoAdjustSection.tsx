import React from 'react';
import { AlertTriangle, Check, RotateCcw, Sparkles, X } from 'lucide-react';
import { CustomSelect } from '../../CustomSelect';
import { ModelDownloadGate } from '../../ModelDownloadGate';
import { PassportBackgroundPicker } from '../../PassportBackgroundPicker';
import type { PassportAIState } from '../hooks/usePassportAI';
import type { PhotoQueueItem } from '../types';
import { Button, FieldLabel, Segmented, SettingsCard, Switch, cx } from '../ui/primitives';

export const AutoAdjustSection: React.FC<{
  ai: PassportAIState;
  photoQueue: PhotoQueueItem[];
}> = ({ ai, photoQueue }) => (
  <SettingsCard
    icon={<Sparkles size={15} />}
    title="AI auto-adjust"
    description="Detect face, remove background and crop to spec"
    aside={
      <Switch
        checked={ai.autoAdjust}
        onChange={ai.toggleAutoAdjust}
        title="Automatically detect face and remove background on newly uploaded photos"
      />
    }
  >
    {ai.autoAdjust && (
      <div className="space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <FieldLabel>Face detection model</FieldLabel>
            <CustomSelect
              value={ai.faceModel}
              onChange={ai.setFaceModel}
              options={ai.faceModels.map(m => ({ value: m.id, label: m.name }))}
            />
          </div>
          <div>
            <FieldLabel>Background removal model</FieldLabel>
            <CustomSelect
              value={ai.bgModel}
              onChange={ai.setBgModel}
              options={ai.bgModels.map(m => ({ value: m.id, label: m.name }))}
            />
          </div>
          <div>
            <FieldLabel>Passport background</FieldLabel>
            <PassportBackgroundPicker value={ai.background} onChange={ai.setBackground} />
          </div>
        </div>

        <div>
          <FieldLabel>Apply to</FieldLabel>
          <Segmented
            value={ai.applyTargetMode}
            onChange={(mode) => {
              // Radio semantics: re-selecting the active option is a no-op.
              if (mode === ai.applyTargetMode) return;
              if (mode === 'all') ai.selectAllTargets();
              else ai.selectSpecificTargets();
            }}
            options={[
              { value: 'all', label: 'All photos' },
              { value: 'specific', label: 'Select manually' },
            ]}
          />
        </div>

        {ai.applyTargetMode === 'specific' && photoQueue.length > 0 && (
          <div className="grid grid-cols-5 gap-1.5">
            {photoQueue.map(photo => {
              const selected = ai.applyTargetIds.includes(photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => ai.toggleTargetPhoto(photo)}
                  className={cx(
                    'relative aspect-3/4 rounded-md overflow-hidden border-2 transition-all',
                    selected ? 'border-blue-600' : 'border-transparent opacity-50 hover:opacity-80',
                  )}
                >
                  <img src={photo.originalSrc || photo.src} alt="" className="w-full h-full object-cover" />
                  {selected && (
                    <span className="absolute top-0.5 right-0.5 bg-blue-600 text-white rounded-full p-0.5">
                      <Check size={9} strokeWidth={4} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* AI failures used to be swallowed, which on mobile looked like the feature
            doing nothing at all. Surface it next to the button that triggers it. */}
        {ai.aiError && (
          <div className="rounded-lg border p-3 bg-amber-50 border-amber-200 dark:bg-amber-500/[0.07] dark:border-amber-500/25">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">AI could not run</p>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 leading-snug wrap-break-word mt-0.5">{ai.aiError}</p>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/60 leading-snug mt-1">
                  Models download on first use and need memory to run; a smaller photo or a lighter model may work better on this device.
                </p>
              </div>
              <button
                type="button"
                onClick={ai.dismissError}
                className="shrink-0 p-0.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/10"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Models must be present before Apply AI can do anything. Each card downloads
            on demand and can be cancelled mid-flight. */}
        {!ai.faceModelState.isReady && (
          <ModelDownloadGate modelId={ai.faceModel} label="Face Detection" />
        )}
        {!ai.bgModelState.isReady && (
          <ModelDownloadGate modelId={ai.bgModel} label="Background Removal" />
        )}

        <div className="flex gap-2">
          <Button onClick={ai.revertTargets} icon={<RotateCcw size={13} />} className="flex-1">
            Revert
          </Button>
          <Button
            variant="primary"
            onClick={ai.applyToTargets}
            disabled={!ai.aiModelsReady}
            title={ai.aiModelsReady ? 'Run face detection and background removal' : 'Download the models above first'}
            icon={<Sparkles size={13} />}
            className="flex-2"
          >
            Apply AI
          </Button>
        </div>
      </div>
    )}
  </SettingsCard>
);
