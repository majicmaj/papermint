/**
 * Tag colors: step 9 of twelve Radix scales, copied from theme/vendor/radix/light.ts.
 * Paperless stores a tag color as hex, so these are the values it receives.
 */
export const TAG_COLORS = [
  { name: 'Gray', hex: '#8d8d8d' },
  { name: 'Indigo', hex: '#3e63dd' },
  { name: 'Blue', hex: '#0090ff' },
  { name: 'Cyan', hex: '#00a2c7' },
  { name: 'Teal', hex: '#12a594' },
  { name: 'Green', hex: '#30a46c' },
  { name: 'Amber', hex: '#ffc53d' },
  { name: 'Orange', hex: '#f76b15' },
  { name: 'Red', hex: '#e5484d' },
  { name: 'Crimson', hex: '#e93d82' },
  { name: 'Purple', hex: '#8e4ec6' },
  { name: 'Brown', hex: '#ad7f58' },
] as const;

export const DEFAULT_TAG_COLOR = TAG_COLORS[0].hex;
