<script setup lang="ts">
import { computed, ref } from 'vue';
import { copyText, lastCopied } from '../composables/useClipboard';
import { toThemeCss, toJson, toSwiftUi, toKotlin, type ThemeScales } from 'stripper';
import { state } from '../composables/useStudioState';
import { buildConfigJson } from '../lib/configExport';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const props = defineProps<{ scales: ThemeScales }>();

type Tab = 'css' | 'json' | 'swift' | 'kotlin' | 'config';

const TABS: Array<{ value: Tab; label: string; file: string; mime: string }> = [
  { value: 'css', label: '@theme CSS', file: 'theme.css', mime: 'text/css' },
  { value: 'json', label: 'JSON', file: 'tokens.json', mime: 'application/json' },
  { value: 'swift', label: 'SwiftUI', file: 'Colors.swift', mime: 'text/plain' },
  { value: 'kotlin', label: 'Kotlin', file: 'Colors.kt', mime: 'text/plain' },
  { value: 'config', label: 'Config JSON', file: 'config.json', mime: 'application/json' },
];

const tab = ref<Tab>('css');
const meta = computed(() => TABS.find((t) => t.value === tab.value)!);

const content = computed(() => {
  switch (tab.value) {
    case 'css':
      return toThemeCss(props.scales);
    case 'json':
      return toJson(props.scales);
    case 'swift':
      return toSwiftUi(props.scales);
    case 'kotlin':
      return toKotlin(props.scales);
    case 'config':
      return buildConfigJson({
        presetMode: state.presetMode,
        primary: { anchors: state.primaryAnchors, config: state.primaryConfig },
        neutral: { anchors: state.neutralAnchors, config: state.neutralConfig, tint: state.neutralTint },
      });
  }
});

async function copy() {
  await copyText(content.value);
}
function download() {
  const blob = new Blob([content.value], { type: meta.value.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = meta.value.file;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <Card class="pt-0 pb-0 gap-0 overflow-hidden">
    <Tabs v-model="tab">
      <div class="flex items-center gap-2 border-b border-border px-3 py-2">
        <TabsList class="h-7">
          <TabsTrigger v-for="t in TABS" :key="t.value" :value="t.value" class="text-xs">{{ t.label }}</TabsTrigger>
        </TabsList>
        <div class="ml-auto flex items-center gap-2">
          <span v-if="lastCopied" class="text-[10px] text-emerald-600 dark:text-emerald-400">copied</span>
          <Button variant="outline" size="sm" @click="copy">Copy</Button>
          <Button variant="outline" size="sm" @click="download">Download</Button>
        </div>
      </div>
      <TabsContent v-for="t in TABS" :key="t.value" :value="t.value" class="mt-0">
        <pre class="max-h-72 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">{{ content }}</pre>
      </TabsContent>
    </Tabs>
  </Card>
</template>
