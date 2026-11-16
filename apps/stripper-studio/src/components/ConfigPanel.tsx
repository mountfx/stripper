import { type ScaleConfig, TAILWIND_FAMILIES } from 'stripper';
import { MAX_ANCHORS, type NeutralTint, type ScaleKey } from '@/context/StudioState';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const NEUTRAL_TINT_ITEMS = [
  { value: 'own', label: 'own (from brand color)' },
  { value: 'primary', label: 'borrow from primary' },
] as const;

export interface ConfigPanelProps {
  role: ScaleKey;
  anchors: string[];
  config: ScaleConfig;
  preset: string | null;
  neutralTint?: NeutralTint;
  onAnchorsChange(anchors: string[]): void;
  onConfigChange(config: ScaleConfig): void;
  onNeutralTintChange?(tint: NeutralTint): void;
  onPresetChange(familyId: string | null): void;
  onReset(): void;
}

export function ConfigPanel({
  role,
  anchors,
  config,
  preset,
  neutralTint,
  onAnchorsChange,
  onConfigChange,
  onNeutralTintChange,
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
        <SelectRoot items={PRESET_ITEMS} value={preset} onValueChange={(value) => onPresetChange(value ?? null)}>
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
        <Label className="text-xs">Brand colors ({role})</Label>
        <div className="space-y-1.5">
          {anchors.map((hex, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={hex}
                aria-label={`Brand color ${i + 1}`}
                className="h-8 w-10 shrink-0 cursor-pointer border border-input bg-transparent"
                onChange={(e) => updateAnchor(i, e.target.value)}
              />
              <Input
                value={hex}
                className="font-mono text-xs"
                spellCheck={false}
                onChange={(e) => updateAnchor(i, e.target.value)}
              />
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
            Multi-anchor: colors are placed by lightness and the scale transitions between them. Drift, tint and
            Tailwind transfer do not apply.
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
              id={`keep-${role}`}
              checked={config.keepAnchorsExact === true}
              onCheckedChange={(value) => patch({ keepAnchorsExact: value === true })}
            />
            <Label htmlFor={`keep-${role}`} className="text-xs font-normal">
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

      {role === 'neutral' && neutralTint && (
        <div className="space-y-1.5">
          <Label className="text-xs">Neutral tint hue</Label>
          <SelectRoot
            items={NEUTRAL_TINT_ITEMS}
            value={neutralTint}
            onValueChange={(value) => onNeutralTintChange?.(value as NeutralTint)}
          >
            <SelectTrigger aria-label="Neutral tint hue" className="w-full text-xs" />
            <SelectContent>
              <SelectItem value="own">own (from brand color)</SelectItem>
              <SelectItem value="primary">borrow from primary</SelectItem>
            </SelectContent>
          </SelectRoot>
        </div>
      )}

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
