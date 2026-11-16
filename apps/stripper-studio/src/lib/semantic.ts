import { oklchString, type Scale } from 'stripper';

/**
 * Initial shadcn-style semantic token mapping, applied to the studio UI itself
 * so that generated color schemes can be tested on a real interface.
 *
 * The neutral scale drives surfaces (background/cards/muted/borders), the
 * primary scale drives actions (primary/ring/charts). Light and dark variants
 * are derived together; destructive stays at the shadcn default (no red scale
 * exists in the system yet).
 *
 * App-layer concern for now — it will graduate into the design-system package.
 */

const white = 'oklch(1 0 0)';

function stepValue(scale: Scale, step: number): string {
  const found = scale.steps.find((s) => s.number === step);
  return found ? oklchString(found) : white;
}

export function studioThemeCss(primary: Scale, neutral: Scale): string {
  const p = (step: number) => stepValue(primary, step);
  const n = (step: number) => stepValue(neutral, step);

  const light = {
    background: n(50),
    foreground: n(950),
    card: white,
    'card-foreground': n(950),
    popover: white,
    'popover-foreground': n(950),
    primary: p(600),
    'primary-foreground': white,
    secondary: n(100),
    'secondary-foreground': n(900),
    muted: n(100),
    'muted-foreground': n(600),
    accent: n(100),
    'accent-foreground': n(900),
    border: n(200),
    input: n(200),
    ring: p(500),
    'chart-1': p(500),
    'chart-2': p(300),
    'chart-3': p(700),
    'chart-4': p(400),
    'chart-5': p(800),
  };

  const dark = {
    background: n(950),
    foreground: n(50),
    card: n(900),
    'card-foreground': n(50),
    popover: n(900),
    'popover-foreground': n(50),
    primary: p(500),
    'primary-foreground': white,
    secondary: n(900),
    'secondary-foreground': n(100),
    muted: n(900),
    'muted-foreground': n(400),
    accent: n(900),
    'accent-foreground': n(100),
    border: n(800),
    input: n(800),
    ring: p(500),
    'chart-1': p(400),
    'chart-2': p(600),
    'chart-3': p(300),
    'chart-4': p(700),
    'chart-5': p(200),
  };

  const block = (selector: string, vars: Record<string, string>): string =>
    `${selector} {\n${Object.entries(vars)
      .map(([name, value]) => `  --${name}: ${value};`)
      .join('\n')}\n}`;

  // html:root / html.dark raise specificity above the app.css base theme
  // (:root / .dark = 0,1,0) so runtime values win regardless of style order.
  return `${block('html:root', light)}\n${block('html.dark', dark)}\n`;
}
