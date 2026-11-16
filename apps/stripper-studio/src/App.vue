<script setup lang="ts">
import { computed } from 'vue';
import { type ThemeScales } from 'stripper';
import { applyKonvertoPreset, applyRandom, markCustom, neutralResult, primaryResult, state } from './composables/useStudioState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import ConfigPanel from './components/ConfigPanel.vue';
import ExportPanel from './components/ExportPanel.vue';
import ScaleSection from './components/ScaleSection.vue';
import { defaultConfig } from 'stripper';

const scales = computed<ThemeScales>(() => {
 const out: ThemeScales = [];
 if (primaryResult.value.scale) out.push({ name: 'primary', scale: primaryResult.value.scale });
 if (neutralResult.value.scale) out.push({ name: 'neutral', scale: neutralResult.value.scale });
 return out;
});

const presetActive = computed(() => state.presetMode);

function resetScale(scale: 'primary' | 'neutral') {
 markCustom();
 if (scale === 'primary') state.primaryConfig = defaultConfig();
 else state.neutralConfig = { ...defaultConfig(), contrastMode: 'none' };
}
</script>

<template>
 <TooltipProvider :delay-duration="150">
  <div class="min-h-screen bg-background text-foreground">
   <header class="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
     <div class="flex items-center gap-2">
      <span class="h-4 w-4" style="background: linear-gradient(135deg, #a286fd 50%, #798680 50%)"></span>
      <h1 class="text-sm font-semibold tracking-tight">Stripper Studio</h1>
      <span class="text-[10px] text-muted-foreground">konverto lab · design tokens</span>
     </div>
     <div class="ml-auto flex items-center gap-2">
      <Badge v-if="presetActive" variant="secondary" class="text-[10px]">Konverto preset (exact)</Badge>
      <Button variant="outline" size="sm" @click="applyKonvertoPreset()">Konverto Lab</Button>
      <Button variant="outline" size="sm" @click="applyRandom()">Random</Button>
      <Button variant="ghost" size="sm" @click="state.dark = !state.dark">{{ state.dark ? 'Light' : 'Dark' }}</Button>
     </div>
    </div>
   </header>

   <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
    <aside class="space-y-6">
     <Card>
      <CardHeader class="pb-3">
       <CardTitle class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Primary scale</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
       <ConfigPanel
        role="primary"
        :anchors="state.primaryAnchors"
        :config="state.primaryConfig"
        @update:anchors="[(state.primaryAnchors = $event), markCustom()]"
        @update:config="[(state.primaryConfig = $event), markCustom()]"
        @reset="resetScale('primary')"
       />
      </CardContent>
     </Card>
     <Card>
      <CardHeader class="pb-3">
       <CardTitle class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Neutral scale</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
       <ConfigPanel
        role="neutral"
        :anchors="state.neutralAnchors"
        :config="state.neutralConfig"
        :neutral-tint="state.neutralTint"
        @update:anchors="[(state.neutralAnchors = $event), markCustom()]"
        @update:config="[(state.neutralConfig = $event), markCustom()]"
        @update:neutral-tint="[(state.neutralTint = $event), markCustom()]"
        @reset="resetScale('neutral')"
       />
      </CardContent>
     </Card>
    </aside>

    <main class="min-w-0 space-y-10">
     <p v-if="state.presetMode" class=" border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-foreground">
      Showing the exact Konverto Lab brand scales. Change any input or option to switch to generated scales.
     </p>

     <!-- Primary -->
     <ScaleSection
      role="primary"
      title="primary"
      :scale="primaryResult.scale"
      :error="primaryResult.error"
     />
     <Separator />
     <!-- Neutral -->
     <ScaleSection
      role="neutral"
      title="neutral"
      :scale="neutralResult.scale"
      :error="neutralResult.error"
     />

     <!-- Export -->
     <section class="space-y-3">
      <h2 class="text-sm font-semibold">Export</h2>
      <ExportPanel :scales="scales" />
      <p class="text-[11px] text-muted-foreground">
       Tailwind v4 <code class="font-mono">@theme</code> tokens. Import into the app CSS:
       <code class="font-mono">@import "tailwindcss"; {{ '@theme { --color-primary-500: …; }' }}</code>
       Also exports SwiftUI and Jetpack Compose color tokens, plus the applied scheme configuration as JSON.
      </p>
     </section>

     <footer class="pb-8 text-[11px] leading-relaxed text-muted-foreground">
      Contrast values are APCA Lc (0.0.98G-4g). Positive = dark text on light background, negative = light text on dark
      background. Level chips follow the APCA Readability Criterion: 90 preferred body · 75 body · 60 content · 45 large ·
      30 headlines · 15 spot/non-text. Consistent-contrast mode re-solves each step's lightness against the fixed
      target ladder (same principle as uicolors' generator of the same name).
     </footer>
    </main>
   </div>
  </div>
 </TooltipProvider>
</template>
