'use client';

export interface ChartTheme {
  colors: string[];
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
}

export function readChartTheme(element: HTMLElement): ChartTheme {
  const computed = getComputedStyle(element);
  return {
    colors: Array.from({ length: 6 }, (_, index) =>
      computed.getPropertyValue(`--chart-${index + 1}`).trim(),
    ).filter((color) => color !== ''),
    foreground: computed.getPropertyValue('--foreground').trim(),
    mutedForeground: computed.getPropertyValue('--muted-foreground').trim(),
    card: computed.getPropertyValue('--card').trim(),
    border: computed.getPropertyValue('--border').trim(),
  };
}
