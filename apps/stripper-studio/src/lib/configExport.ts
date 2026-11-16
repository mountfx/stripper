import type { ScaleConfig } from 'stripper';

/** The configuration applied to the color schemes, per scheme. */
export interface ConfigExportInput {
  /** true when the scales are the hand-tuned Konverto preset rather than generated */
  presetMode: boolean;
  primary: { anchors: string[]; config: ScaleConfig };
  neutral: { anchors: string[]; config: ScaleConfig; tint: 'own' | 'primary' };
}

/**
 * JSON of the applied configuration — the recipe, not the tokens: anchors plus
 * the ScaleConfig each scheme was generated with (and the neutral tint rule).
 * With `presetMode` the scales come from the hand-tuned preset instead.
 */
export function buildConfigJson(input: ConfigExportInput): string {
  return (
    JSON.stringify(
      {
        primary: { anchors: input.primary.anchors, config: input.primary.config },
        neutral: { anchors: input.neutral.anchors, config: input.neutral.config, tint: input.neutral.tint },
        presetMode: input.presetMode,
      },
      null,
      2,
    ) + '\n'
  );
}
