export const CAMERA_DEFINITIONS = {
  komodo: {
    id: 'komodo' as const,
    name: 'RED Komodo 6K',
    manufacturer: 'RED',
  },
};

export const PALETTE: readonly string[] = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#22C55E', // green
  '#F59E0B', // amber
  '#A855F7', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export function nextColor(usedColors: string[]): string {
  return PALETTE.find((c) => !usedColors.includes(c)) ?? PALETTE[0];
}
