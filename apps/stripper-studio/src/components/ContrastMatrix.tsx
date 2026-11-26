import { useState } from 'react';
import { APCA_LEVELS, WCAG_LEVELS, apcaLevel, lc, wcagLevel, wcagRatio, type Scale } from '@mountfx/stripper';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ---- axis: uicolors' familyWithBlackAndWhite --------------------------------------

interface AxisEntry {
  label: string;
  hex: string;
  /** for the hover overlay: light backgrounds get a white veil, dark ones a black veil */
  light: boolean;
}

type ContrastType = 'apca' | 'wcag';

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

const PILL_ACTIVE = 'bg-primary text-primary-foreground';
const PILL_INACTIVE = 'text-muted-foreground hover:text-foreground';

// ---- pair values -------------------------------------------------------------------

interface Cell {
  row: number;
  col: number;
  apca: number;
  wcag: number;
}

export function ContrastMatrix({ scale }: { scale: Scale | null }) {
  const [contrastType, setContrastType] = useState<ContrastType>('apca');
  const [filteredLc, setFilteredLc] = useState(60);
  const [filteredRatio, setFilteredRatio] = useState(4.5);

  if (!scale) return null;

  const axis: AxisEntry[] = [{ label: 'White', hex: '#ffffff', light: true }];
  for (const step of scale.steps) {
    axis.push({ label: String(step.number), hex: step.hex, light: step.oklch.l > 0.62 });
  }
  axis.push({ label: 'Black', hex: '#000000', light: false });

  const cells: Cell[][] = axis.map((fg, i) =>
    axis.map((bg, j) => ({
      row: i,
      col: j,
      apca: lc(fg.hex, bg.hex),
      wcag: wcagRatio(fg.hex, bg.hex),
    })),
  );

  /**
   * The reported Lc: rounded to the nearest integer on the magnitude, the
   * convention APCA tooling uses for reporting. Thresholds (pill visibility,
   * displayed value, level text) are all judged on the reported value — so a
   * cell that reads "-60" never toggles at the 60+ pill while its number
   * stays put. This is coherent with the generator's own ±2 Lc tolerance;
   * the engine's `apcaLevel` remains the strict raw-value reference.
   */
  function reportedLc(v: number): number {
    return (v < 0 ? -1 : 1) * Math.round(Math.abs(v));
  }

  /**
   * The reported WCAG ratio: rounded to one decimal. Thresholds (pill
   * visibility, displayed value, level text) are all judged on the reported
   * value — a cell that reads "4.5" never toggles at the 4.5+ pill while its
   * number stays put. Same reporting convention as `reportedLc`; the engine's
   * `wcagLevel` remains the strict raw-value reference.
   */
  function reportedRatio(v: number): number {
    return Math.round(v * 10) / 10;
  }

  function passes(cell: Cell): boolean {
    if (contrastType === 'apca') {
      // dual form so the "All" pill (0) still shows everything, including
      // negative-Lc cells
      const reported = reportedLc(cell.apca);
      return reported >= filteredLc || reported <= -filteredLc;
    }
    return reportedRatio(cell.wcag) >= filteredRatio;
  }

  function cellValue(cell: Cell): string {
    if (contrastType === 'apca') return String(reportedLc(cell.apca));
    return String(reportedRatio(cell.wcag));
  }

  function cellLevelText(cell: Cell): string {
    if (contrastType === 'apca') {
      const level = apcaLevel(reportedLc(cell.apca));
      if (level === null) return 'below Lc 15';
      const desc = APCA_LEVELS.find((l) => l.min === level)!.label;
      return `meets Lc ${level} — ${desc}`;
    }
    const level = wcagLevel(reportedRatio(cell.wcag));
    if (level === null) return 'below 3:1';
    const desc = WCAG_LEVELS.find((l) => l.min === level)!.label;
    return `meets ${level}:1 — ${desc}`;
  }

  function pairLabel(i: number, j: number): string {
    return `${axis[i]!.label} text on ${axis[j]!.label} background`;
  }

  function fmtRatio(v: number): string {
    return `${Math.round(v * 100) / 100}:1`;
  }

  const helperText =
    contrastType === 'apca'
      ? filteredLc === 0
        ? 'Showing all pairs'
        : `Lc ${filteredLc} · ${APCA_DESC[filteredLc]!}`
      : filteredRatio === 0
        ? 'Showing all pairs'
        : `${filteredRatio}:1 · ${WCAG_DESC[filteredRatio]!}`;

  return (
    <div className="space-y-3">
      {/* toolbar: metric toggle + threshold pills (uicolors-style) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          className={cn('px-2 py-1 text-xs transition-colors', contrastType === 'apca' ? PILL_ACTIVE : PILL_INACTIVE)}
          onClick={() => setContrastType('apca')}
        >
          APCA L<sup>c</sup>
        </button>
        <button
          className={cn('px-2 py-1 text-xs transition-colors', contrastType === 'wcag' ? PILL_ACTIVE : PILL_INACTIVE)}
          onClick={() => setContrastType('wcag')}
        >
          WCAG 2.2
        </button>
        <span className="mx-1 text-muted-foreground">·</span>
        {contrastType === 'apca'
          ? APCA_PILLS.map((pill) => (
              <button
                key={pill}
                className={cn(
                  'px-2 py-1 font-mono text-xs transition-colors',
                  filteredLc === pill ? PILL_ACTIVE : PILL_INACTIVE,
                )}
                onClick={() => setFilteredLc(pill)}
              >
                {pill === 0 ? 'All' : pill + '+'}
              </button>
            ))
          : WCAG_PILLS.map((pill) => (
              <button
                key={pill}
                className={cn(
                  'px-2 py-1 font-mono text-xs transition-colors',
                  filteredRatio === pill ? PILL_ACTIVE : PILL_INACTIVE,
                )}
                onClick={() => setFilteredRatio(pill)}
              >
                {pill === 0 ? 'All' : pill + '+'}
              </button>
            ))}
      </div>
      <p className="text-[11px] text-muted-foreground">{helperText}</p>

      {/* matrix: rows = text color, columns = background color */}
      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-1" />
              {axis.map((bg, j) => (
                <th key={`h${j}`} className="p-1 pb-2 text-center text-xs font-normal text-muted-foreground">
                  {bg.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axis.map((fg, i) => (
              <tr key={`r${i}`}>
                <th className="p-1 pr-2 text-right text-xs font-normal text-muted-foreground">{fg.label}</th>
                {cells[i]!.map((cell, j) => (
                  <td key={`c${j}`} className="p-0.5">
                    <Tooltip
                      className="max-w-64 space-y-1 font-mono"
                      content={
                        <>
                          <p>{pairLabel(i, j)}</p>
                          <p>
                            {contrastType === 'apca' ? `Lc ${cell.apca.toFixed(1)}` : fmtRatio(cell.wcag)} —{' '}
                            {cellLevelText(cell)}
                          </p>
                        </>
                      }
                    >
                      {passes(cell) ? (
                        <div
                          className="flex h-12 w-full min-w-12 cursor-default items-center justify-center"
                          style={{ backgroundColor: axis[j]!.hex, color: fg.hex }}
                        >
                          <span
                            className={cn(
                              'flex h-full w-full items-center justify-center font-mono text-[11px] font-medium transition-colors',
                              axis[j]!.light ? 'hover:bg-white/10' : 'hover:bg-black/5',
                            )}
                          >
                            {cellValue(cell)}
                          </span>
                        </div>
                      ) : (
                        <div className="h-12 w-full min-w-12 bg-muted" />
                      )}
                    </Tooltip>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Rows: text color · Columns: background color. Cells whose reported value is below the threshold are hidden.
      </p>
    </div>
  );
}
