<script setup lang="ts">
import { computed, ref } from 'vue';
import {
 APCA_LEVELS,
 WCAG_LEVELS,
 apcaLevel,
 lc,
 wcagLevel,
 wcagRatio,
 type Scale,
} from 'stripper';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const props = defineProps<{ scale: Scale | null }>();

// ---- axis: uicolors' familyWithBlackAndWhite --------------------------------------
interface AxisEntry {
 label: string;
 hex: string;
 /** for the hover overlay: light backgrounds get a white veil, dark ones a black veil */
 light: boolean;
}

const axis = computed<AxisEntry[]>(() => {
 const entries: AxisEntry[] = [{ label: 'White', hex: '#ffffff', light: true }];
 for (const step of props.scale?.steps ?? []) {
  entries.push({ label: String(step.number), hex: step.hex, light: step.oklch.l > 0.62 });
 }
 entries.push({ label: 'Black', hex: '#000000', light: false });
 return entries;
});

// ---- filters (uicolors defaults) ---------------------------------------------------
type ContrastType = 'apca' | 'wcag';
const contrastType = ref<ContrastType>('apca');
const filteredLc = ref(60);
const filteredRatio = ref(4.5);

const APCA_PILLS = [15, 30, 45, 60, 75, 90, 0];
const WCAG_PILLS = [3, 4.5, 7, 0];

const APCA_DESC: Record<number, string> = {
 15: 'Decorative text and dividers',
 30: 'Non-essential text (placeholder, disabled)',
 45: 'Large text (24px bold / 36px regular)',
 60: 'Small text (non-body), UI elements',
 75: 'Body text (minimum)',
 90: 'Body text (preferred)',
};

const WCAG_DESC: Record<number, string> = {
 3: 'Minimum for headings, titles and non-text',
 4.5: 'Body text (minimum)',
 7: 'Body text (preferred)',
};

const helperText = computed(() => {
 if (contrastType.value === 'apca') {
  return filteredLc.value === 0 ? 'Showing all pairs' : `Lc ${filteredLc.value} · ${APCA_DESC[filteredLc.value]!}`;
 }
 return filteredRatio.value === 0 ? 'Showing all pairs' : `${filteredRatio.value}:1 · ${WCAG_DESC[filteredRatio.value]!}`;
});

// ---- pair values -------------------------------------------------------------------
interface Cell {
 row: number;
 col: number;
 apca: number;
 wcag: number;
}

const cells = computed<Cell[][]>(() => {
 const entries = axis.value;
 return entries.map((fg, i) =>
  entries.map((bg, j) => ({
   row: i,
   col: j,
   apca: lc(fg.hex, bg.hex),
   wcag: wcagRatio(fg.hex, bg.hex),
  })),
 );
});

function passes(cell: Cell): boolean {
 if (contrastType.value === 'apca') {
  return cell.apca >= filteredLc.value || cell.apca <= -filteredLc.value;
 }
 return cell.wcag >= filteredRatio.value;
}

function cellValue(cell: Cell): string {
 if (contrastType.value === 'apca') return String(Math.round(cell.apca));
 return String(Math.round(cell.wcag * 10) / 10);
}

function cellLevelText(cell: Cell): string {
 if (contrastType.value === 'apca') {
  const level = apcaLevel(cell.apca);
  if (level === null) return 'below Lc 15';
  const desc = APCA_LEVELS.find((l) => l.min === level)!.label;
  return `meets Lc ${level} — ${desc}`;
 }
 const level = wcagLevel(cell.wcag);
 if (level === null) return 'below 3:1';
 const desc = WCAG_LEVELS.find((l) => l.min === level)!.label;
 return `meets ${level}:1 — ${desc}`;
}

function pairLabel(i: number, j: number): string {
 return `${axis.value[i]!.label} text on ${axis.value[j]!.label} background`;
}

function fmtRatio(v: number): string {
 return `${Math.round(v * 100) / 100}:1`;
}
</script>

<template>
 <div v-if="scale" class="space-y-3">
  <!-- toolbar: metric toggle + threshold pills (uicolors-style) -->
  <div class="flex flex-wrap items-center gap-1.5">
   <button
    :class="[
     ' px-2 py-1 text-xs transition-colors',
     contrastType === 'apca' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
    ]"
    @click="contrastType = 'apca'"
   >APCA L<sup>c</sup></button>
   <button
    :class="[
     ' px-2 py-1 text-xs transition-colors',
     contrastType === 'wcag' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
    ]"
    @click="contrastType = 'wcag'"
   >WCAG 2.2</button>
   <span class="mx-1 text-muted-foreground">·</span>
   <template v-if="contrastType === 'apca'">
    <button
     v-for="pill in APCA_PILLS"
     :key="pill"
     :class="[
      ' px-2 py-1 font-mono text-xs transition-colors',
      filteredLc === pill ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
     ]"
     @click="filteredLc = pill"
    >{{ pill === 0 ? 'All' : pill + '+' }}</button>
   </template>
   <template v-else>
    <button
     v-for="pill in WCAG_PILLS"
     :key="pill"
     :class="[
      ' px-2 py-1 font-mono text-xs transition-colors',
      filteredRatio === pill ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
     ]"
     @click="filteredRatio = pill"
    >{{ pill === 0 ? 'All' : pill + '+' }}</button>
   </template>
  </div>
  <p class="text-[11px] text-muted-foreground">{{ helperText }}</p>

  <!-- matrix: rows = text color, columns = background color -->
  <div class="overflow-x-auto border border-border">
   <table class="w-full border-collapse">
    <thead>
     <tr>
      <th class="p-1"></th>
      <th v-for="(bg, j) in axis" :key="'h' + j" class="p-1 pb-2 text-center text-xs font-normal text-muted-foreground">
       {{ bg.label }}
      </th>
     </tr>
    </thead>
    <tbody>
     <tr v-for="(fg, i) in axis" :key="'r' + i">
      <th class="p-1 pr-2 text-right text-xs font-normal text-muted-foreground">{{ fg.label }}</th>
      <td v-for="(cell, j) in cells[i]!" :key="'c' + j" class="p-0.5">
       <Tooltip>
        <TooltipTrigger as-child>
         <div
          v-if="passes(cell)"
          class="flex h-12 w-full min-w-12 cursor-default items-center justify-center"
          :style="{ backgroundColor: axis[j]!.hex, color: fg.hex }"
         >
          <span
           :class="[
            'flex h-full w-full items-center justify-center font-mono text-[11px] font-medium transition-colors',
            axis[j]!.light ? 'hover:bg-white/10' : 'hover:bg-black/5',
           ]"
          >{{ cellValue(cell) }}</span>
         </div>
         <div v-else class="h-12 w-full min-w-12 bg-striped"></div>
        </TooltipTrigger>
        <TooltipContent class="max-w-64 space-y-1 font-mono">
         <p>{{ pairLabel(i, j) }}</p>
         <p>
          {{
           contrastType === 'apca'
            ? 'Lc ' + cell.apca.toFixed(1)
            : fmtRatio(cell.wcag)
          }}
          — {{ cellLevelText(cell) }}
         </p>
        </TooltipContent>
       </Tooltip>
      </td>
     </tr>
    </tbody>
   </table>
  </div>
  <p class="text-[11px] text-muted-foreground">
   Rows: text color · Columns: background color. Cells below the threshold are hidden.
  </p>
 </div>
</template>
