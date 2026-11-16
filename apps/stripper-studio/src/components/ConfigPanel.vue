<script setup lang="ts">
import { computed } from 'vue';
import { X } from 'lucide-vue-next';
import { type ContrastMode, type ScaleConfig } from 'stripper';
import { Checkbox } from '@/components/ui/checkbox';
import { MAX_ANCHORS } from '../composables/useStudioState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';

const props = defineProps<{
 role: 'primary' | 'neutral';
 anchors: string[];
 config: ScaleConfig;
 neutralTint?: 'own' | 'primary';
}>();
const emit = defineEmits<{
 'update:anchors': [value: string[]];
 'update:config': [value: ScaleConfig];
 'update:neutralTint': [value: 'own' | 'primary'];
 reset: [];
}>();

function clone(): ScaleConfig {
 return JSON.parse(JSON.stringify(props.config)) as ScaleConfig;
}

function patch(partial: Partial<ScaleConfig>) {
 emit('update:config', { ...clone(), ...partial });
}

function patchNested<K extends 'hue' | 'chroma'>(key: K, partial: Partial<ScaleConfig[K]>) {
 const next = clone();
 next[key] = { ...next[key], ...partial };
 emit('update:config', next);
}

const contrastMode = computed({
 get: () => props.config.contrastMode,
 set: (v: string) => patch({ contrastMode: v as ContrastMode }),
});

function updateAnchor(index: number, hex: string) {
 const next = [...props.anchors];
 next[index] = hex;
 emit('update:anchors', next);
}

function addAnchor() {
 if (props.anchors.length >= MAX_ANCHORS) return;
 emit('update:anchors', [...props.anchors, '#888888']);
}

function removeAnchor(index: number) {
 if (props.anchors.length <= 1) return;
 emit('update:anchors', props.anchors.filter((_, i) => i !== index));
}

const baseMode = computed({
 get: () => props.config.baseMode,
 set: (v: string) => patch({ baseMode: v as ScaleConfig['baseMode'] }),
});

const neutralTint = computed({
 get: () => props.neutralTint ?? 'own',
 set: (v: string) => emit('update:neutralTint', v as 'own' | 'primary'),
});

const driftLight = computed(() => [props.config.hue.driftLight]);
const driftDark = computed(() => [props.config.hue.driftDark]);
const taperLight = computed(() => [props.config.chroma.taperLight]);
const taperDark = computed(() => [props.config.chroma.taperDark]);
</script>

<template>
 <div class="space-y-4">
  <div class="space-y-1.5">
   <Label class="text-xs">Brand colors ({{ role }})</Label>
   <div class="space-y-1.5">
    <div v-for="(hex, i) in anchors" :key="i" class="flex items-center gap-2">
     <input
      type="color"
      :value="hex"
      class="h-8 w-10 shrink-0 cursor-pointer border border-input bg-transparent"
      @input="updateAnchor(i, ($event.target as HTMLInputElement).value)"
     />
     <Input
      :model-value="hex"
      class="font-mono text-xs"
      spellcheck="false"
      @update:model-value="updateAnchor(i, String($event))"
     />
     <Button
      v-if="anchors.length > 1"
      variant="ghost"
      size="icon"
      class="h-7 w-7 shrink-0 text-muted-foreground"
      :title="'Remove brand color ' + hex"
      @click="removeAnchor(i)"
     >
      <X class="h-3.5 w-3.5" />
     </Button>
    </div>
   </div>
   <Button
    v-if="anchors.length < MAX_ANCHORS"
    variant="outline"
    size="sm"
    class="h-7 text-[11px] text-muted-foreground"
    @click="addAnchor()"
   >+ Add brand color</Button>
   <p v-if="anchors.length > 1" class="text-[10px] leading-snug text-muted-foreground">
    Multi-anchor: colors are placed by lightness and the scale transitions between them.
    Drift, tint and Tailwind transfer do not apply.
   </p>
  </div>

  <div class="space-y-1.5">
   <Label class="text-xs">Base curve</Label>
   <Select v-model="baseMode">
    <SelectTrigger class="h-8 text-xs"><SelectValue /></SelectTrigger>
    <SelectContent>
     <SelectItem value="tailwindTransfer">Tailwind transfer</SelectItem>
     <SelectItem value="balancedCurve">Balanced curve</SelectItem>
    </SelectContent>
   </Select>
  </div>

  <div class="space-y-1.5">
   <Label class="text-xs">Consistent contrast</Label>
   <Select v-model="contrastMode">
    <SelectTrigger class="h-8 text-xs"><SelectValue /></SelectTrigger>
    <SelectContent>
     <SelectItem value="none">None (aesthetic only)</SelectItem>
     <SelectItem value="apca">Consistent APCA contrast</SelectItem>
     <SelectItem value="wcag">Consistent WCAG 2.2 contrast</SelectItem>
    </SelectContent>
   </Select>
   <div v-if="config.contrastMode !== 'none'" class="flex items-center gap-2">
    <Checkbox
     :id="`keep-${role}`"
     :model-value="config.keepAnchorsExact === true"
     @update:model-value="(v) => patch({ keepAnchorsExact: v === true })"
    />
    <Label :for="`keep-${role}`" class="text-xs">Keep brand colors exact</Label>
   </div>
   <p v-else class="text-[10px] leading-snug text-muted-foreground">
    Contrast mode is off — brand colors are always kept exact.
   </p>
  </div>

  <Separator />

  <div class="space-y-3">
   <div class="space-y-1.5">
    <Label class="text-xs">Hue drift light (50) — {{ config.hue.driftLight }}°</Label>
    <Slider
     :model-value="driftLight"
     :min="-60"
     :max="60"
     :step="1"
     @update:model-value="(v?: number[]) => patchNested('hue', { driftLight: v?.[0] ?? 0 })"
    />
    <Label class="text-xs">Hue drift dark (950) — {{ config.hue.driftDark }}°</Label>
    <Slider
     :model-value="driftDark"
     :min="-60"
     :max="60"
     :step="1"
     @update:model-value="(v?: number[]) => patchNested('hue', { driftDark: v?.[0] ?? 0 })"
    />
   </div>
  </div>

  <div class="space-y-3">
   <div class="space-y-1.5">
    <Label class="text-xs">Chroma taper light — {{ config.chroma.taperLight.toFixed(2) }}</Label>
    <Slider
     :model-value="taperLight"
     :min="0"
     :max="1.5"
     :step="0.05"
     @update:model-value="(v?: number[]) => patchNested('chroma', { taperLight: v?.[0] ?? 1 })"
    />
    <Label class="text-xs">Chroma taper dark — {{ config.chroma.taperDark.toFixed(2) }}</Label>
    <Slider
     :model-value="taperDark"
     :min="0"
     :max="1.5"
     :step="0.05"
     @update:model-value="(v?: number[]) => patchNested('chroma', { taperDark: v?.[0] ?? 1 })"
    />
   </div>
  </div>

  <div v-if="role === 'neutral'" class="space-y-1.5">
   <Label class="text-xs">Neutral tint hue</Label>
   <Select v-model="neutralTint">
    <SelectTrigger class="h-8 text-xs"><SelectValue /></SelectTrigger>
    <SelectContent>
     <SelectItem value="own">own (from brand color)</SelectItem>
     <SelectItem value="primary">borrow from primary</SelectItem>
    </SelectContent>
   </Select>
  </div>

  <Button variant="ghost" size="sm" class="h-7 w-fit px-2 text-[11px] text-muted-foreground" @click="emit('reset')">
   Reset scale options
  </Button>
 </div>
</template>
