<script setup lang="ts">
import { computed } from 'vue';
import { criticalPairWarnings, type Scale } from 'stripper';
import ScaleStrip from './ScaleStrip.vue';
import ContrastMatrix from './ContrastMatrix.vue';
import CurveChart from './CurveChart.vue';

const props = defineProps<{
  role: 'primary' | 'neutral';
  title: string;
  scale: Scale | null;
  error: string | null;
}>();

const warnings = computed(() =>
  props.scale ? [...props.scale.warnings, ...criticalPairWarnings(props.scale)] : [],
);
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-semibold">{{ title }}</h2>
      <span class="font-mono text-[11px] text-muted-foreground">
        {{ scale?.closestFamily ? 'family: ' + scale.closestFamily + ' · ' : '' }}
        anchor: {{ scale?.anchorStep }}
      </span>
    </div>
    <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
      {{ error }}
    </p>
    <ScaleStrip :scale="scale" :scale-key="role" />
    <p v-for="w in warnings" :key="w" class="font-mono text-[11px] text-amber-600 dark:text-amber-400">⚠ {{ w }}</p>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <CurveChart :scale="scale" metric="l" :scale-key="role" />
      <CurveChart :scale="scale" metric="c" :scale-key="role" />
      <CurveChart :scale="scale" metric="h" :scale-key="role" />
    </div>
    <ContrastMatrix :scale="scale" />
  </section>
</template>
