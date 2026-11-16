// apca-w3 is a dev-only test oracle and is never shipped by the engine.
declare module 'apca-w3' {
  export function APCAcontrast(txtY: number, bgY: number, places?: number): number;
  export function sRGBtoY(rgb: [number, number, number] | number[] | string): number;
  export const version: string;
}
