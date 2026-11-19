// Shared Recharts styling that follows the CSS theme variables in both color schemes.
export const axis = { stroke: 'var(--muted)', tick: { fill: 'var(--muted)', fontSize: 11 }, tickLine: false, axisLine: false } as const;
export const chartTooltip = {
  contentStyle: { background: 'var(--card-solid)', border: '1px solid var(--line-2)', borderRadius: 12, color: 'var(--ink)', fontSize: 12, boxShadow: 'var(--shadow)' },
  labelStyle: { color: 'var(--ink)', fontWeight: 700 },
  itemStyle: { color: 'var(--ink-2)' },
  cursor: { fill: 'color-mix(in srgb, var(--violet) 8%, transparent)' },
} as const;
export const THEME_COLORS: Record<string, string> = {
  'Schedules and shifts': 'var(--coral)', 'Pay and benefits': 'var(--amber)', 'Career growth': 'var(--violet)', 'Manager support': 'var(--teal)',
  'Workload and staffing': 'var(--rose)', 'Tools and systems': '#5b8def', 'Flexibility and remote work': '#3fb37f', Recognition: '#b08bd8',
};
