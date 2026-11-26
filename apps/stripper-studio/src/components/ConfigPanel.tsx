import { type ScaleConfig, TAILWIND_FAMILIES } from '@mountfx/stripper';
import { MAX_ANCHORS } from '@/context/StudioState';
import { ColorPicker, ColorPickerContent, ColorPickerInput } from '@/components/reui/color-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SelectContent, SelectItem, SelectRoot, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { XIcon } from '@/components/ui/icons';

const PRESET_ITEMS = [
  { value: null, label: 'Custom' },
  ...TAILWIND_FAMILIES.map((family) => ({ value: family.id, label: family.name })),
];

const BASE_MODE_ITEMS = [
  { value: 'tailwindTransfer', label: 'Tailwind transfer' },
  { value: 'balancedCurve', label: 'Balanced curve' },
] as const;

const CONTRAST_MODE_ITEMS = [
  { value: 'none', label: 'None (aesthetic only)' },
  { value: 'apca', label: 'Consistent APCA contrast' },
  { value: 'wcag', label: 'Consistent WCAG 2.2 contrast' },
] as const;

export interface ConfigPanelProps {
  /** the owning scheme's id — scopes DOM ids/aria to this scheme */
  schemeId: string;
  anchors: string[];
  config: ScaleConfig;
  preset: string | null;
  onAnchorsChange(anchors: string[]): void;
  onConfigChange(config: ScaleConfig): void;
  onPresetChange(familyId: string | null): void;
  onReset(): void;
}

export function ConfigPanel({
  schemeId,
  anchors,
  config,
  preset,
  onAnchorsChange,
  onConfigChange,
  onPresetChange,
  onReset,
}: ConfigPanelProps) {
  function clone(): ScaleConfig {
    return JSON.parse(JSON.stringify(config)) as ScaleConfig;
  }

  function patch(partial: Partial<ScaleConfig>) {
    onConfigChange({ ...clone(), ...partial });
  }
  function patchNested<K extends 'hue' | 'chroma'>(key: K, partial: Partial<ScaleConfig[K]>) {
    const next = clone();
    next[key] = { ...next[key], ...partial };
    onConfigChange(next);
  }

  function updateAnchor(index: number, hex: string) {
    const next = [...anchors];
    next[index] = hex;
    onAnchorsChange(next);
  }

  function addAnchor() {
    if (anchors.length >= MAX_ANCHORS) return;
    onAnchorsChange([...anchors, '#888888']);
  }

  function removeAnchor(index: number) {
    if (anchors.length <= 1) return;
    onAnchorsChange(anchors.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Preset</Label>
        <SelectRoot
          items={PRESET_ITEMS}
          value={preset}
          onValueChange={(value) => onPresetChange(value ?? null)}
        >
          <SelectTrigger aria-label="Preset" className="w-full text-xs" />
          <SelectContent scrollArrows>
            <SelectItem value={null as string | null}>Custom</SelectItem>
            {TAILWIND_FAMILIES.map((family) => (
              <SelectItem key={family.id} value={family.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-3.5 shrink-0 border border-foreground/20"
                    style={{ backgroundColor: family.shades.find((shade) => shade.number === 500)!.hex }}
                  />
                  {family.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Brand colors</Label>
        <div className="space-y-1.5">
          {anchors.map((hex, i) => (
            <div key={i} className="flex items-center gap-2">
              <ColorPicker
                value={hex}
                format="hex"
                aria-label={`Brand color ${i + 1}`}
                onValueChange={(value) => {
                  if (value) updateAnchor(i, value.toLowerCase())
                }}
              >
                <ColorPickerInput className="font-mono text-xs" spellCheck={false} />
                <ColorPickerContent align="start" />
              </ColorPicker>
              {anchors.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-7 shrink-0 px-0 text-muted-foreground"
                  title={`Remove brand color ${hex}`}
                  onClick={() => removeAnchor(i)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {anchors.length < MAX_ANCHORS && (
          <Button variant="outline" size="sm" className="h-7 text-[11px] text-muted-foreground" onClick={addAnchor}>
            + Add brand color
          </Button>
        )}
        {anchors.length > 1 && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Multi-anchor: colors are placed by lightness and the scale transitions between them. Drift and Tailwind
            transfer do not apply.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Base curve</Label>
        <SelectRoot
          items={BASE_MODE_ITEMS}
          value={config.baseMode}
          onValueChange={(value) => patch({ baseMode: value as ScaleConfig['baseMode'] })}
        >
          <SelectTrigger aria-label="Base curve" className="w-full text-xs" />
          <SelectContent>
            <SelectItem value="tailwindTransfer">Tailwind transfer</SelectItem>
            <SelectItem value="balancedCurve">Balanced curve</SelectItem>
          </SelectContent>
        </SelectRoot>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Consistent contrast</Label>
        <SelectRoot
          items={CONTRAST_MODE_ITEMS}
          value={config.contrastMode}
          onValueChange={(value) => patch({ contrastMode: value as ScaleConfig['contrastMode'] })}
        >
          <SelectTrigger aria-label="Consistent contrast" className="w-full text-xs" />
          <SelectContent>
            <SelectItem value="none">None (aesthetic only)</SelectItem>
            <SelectItem value="apca">Consistent APCA contrast</SelectItem>
            <SelectItem value="wcag">Consistent WCAG 2.2 contrast</SelectItem>
          </SelectContent>
        </SelectRoot>
        {config.contrastMode !== 'none' ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`keep-${schemeId}`}
              checked={config.keepAnchorsExact === true}
              onCheckedChange={(value) => patch({ keepAnchorsExact: value === true })}
            />
            <Label htmlFor={`keep-${schemeId}`} className="text-xs font-normal">
              Keep brand colors exact
            </Label>
          </div>
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Contrast mode is off — brand colors are always kept exact.
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-normal">Hue drift light (50) — {config.hue.driftLight}°</Label>
          <Slider
            thumbAriaLabel="Hue drift light"
            value={[config.hue.driftLight]}
            min={-60}
            max={60}
            step={1}
            onValueChange={(value) => patchNested('hue', { driftLight: (Array.isArray(value) ? value[0] : value) ?? 0 })}
          />
          <Label className="text-xs font-normal">Hue drift dark (950) — {config.hue.driftDark}°</Label>
          <Slider
            thumbAriaLabel="Hue drift dark"
            value={[config.hue.driftDark]}
            min={-60}
            max={60}
            step={1}
            onValueChange={(value) => patchNested('hue', { driftDark: (Array.isArray(value) ? value[0] : value) ?? 0 })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-normal">Chroma taper light — {config.chroma.taperLight.toFixed(2)}</Label>
          <Slider
            thumbAriaLabel="Chroma taper light"
            value={[config.chroma.taperLight]}
            min={0}
            max={1.5}
            step={0.05}
            onValueChange={(value) => patchNested('chroma', { taperLight: (Array.isArray(value) ? value[0] : value) ?? 1 })}
          />
          <Label className="text-xs font-normal">Chroma taper dark — {config.chroma.taperDark.toFixed(2)}</Label>
          <Slider
            thumbAriaLabel="Chroma taper dark"
            value={[config.chroma.taperDark]}
            min={0}
            max={1.5}
            step={0.05}
            onValueChange={(value) => patchNested('chroma', { taperDark: (Array.isArray(value) ? value[0] : value) ?? 1 })}
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-fit px-2 text-[11px] text-muted-foreground"
        onClick={onReset}
      >
        Reset scale options
      </Button>
    </div>
  );
}
