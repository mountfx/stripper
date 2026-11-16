<script setup lang="ts">
import { computed } from 'vue';
import { copyText, lastCopied } from '../composables/useClipboard';
import { clearFocused, isFocused, setFocused, type ScaleKey } from '../composables/useStudioState';
import type { Scale, ScaleStepNumber } from 'stripper';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const props = defineProps<{ scale: Scale | null; scaleKey: ScaleKey }>();

const emit = defineEmits<{ copy: [text: string] }>();

function textColor(hexOnLight: boolean): string {
  return hexOnLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)';
}

interface Row {
  number: ScaleStepNumber;
  hex: string;
  oklch: string;
  approximated: boolean;
  dark: boolean;
  focused: boolean;
  anchored: boolean;
}

const rows = computed<Row[]>(() =>
  props.scale?.steps.map((s) => ({
    number: s.number,
    hex: s.hex,
    oklch: `oklch(${(s.oklch.l * 100).toFixed(1)}% ${s.oklch.c.toFixed(3)} ${s.oklch.h.toFixed(1)})`,
    approximated: s.approximated ?? false,
    // dark steps get light text
    dark: s.oklch.l < 0.62,
    focused: isFocused(props.scaleKey, s.number),
    anchored: props.scale?.anchors?.some((a) => a.step === s.number) ?? false,
  })) ?? [],
);

async function onCopy(row: Row) {
  await copyText(row.hex);
  emit('copy', row.hex);
}
</script>

<template>
  <div v-if="scale" class="flex h-24 overflow-hidden border border-border">
    <Tooltip v-for="row in rows" :key="row.number">
      <TooltipTrigger as-child>
        <div
          class="group relative flex flex-1 cursor-pointer flex-col justify-between p-2 transition-[flex]"
          :class="[
            row.focused ? 'flex-[1.4]' : '',
            !row.focused && 'hover:flex-[1.4]',
          ]"
          :style="{ backgroundColor: row.hex }"
          @click="onCopy(row)"
          @mouseenter="setFocused(props.scaleKey, row.number)"
          @mouseleave="clearFocused(props.scaleKey)"
        >
          <span class="font-mono text-[11px] font-medium" :style="{ color: textColor(!row.dark) }">{{ row.number }}</span>
          <span
            :class="row.focused || 'hidden group-hover:block'"
            class="font-mono text-[10px] leading-tight"
            :style="{ color: textColor(!row.dark) }"
          >{{ row.hex }}{{ row.approximated ? ' *' : '' }}</span>
          <span
            v-if="lastCopied === row.hex"
            class="absolute inset-x-1 top-1 bg-black/70 px-1 text-center font-mono text-[9px] text-white"
          >copied</span>
          <span
            v-if="row.anchored"
            class="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2"
            :style="{ backgroundColor: textColor(!row.dark) }"
            title="brand color anchored here"
          ></span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" class="font-mono">
        {{ row.number }} — {{ row.hex }} · {{ row.oklch }}
      </TooltipContent>
    </Tooltip>
  </div>
</template>
