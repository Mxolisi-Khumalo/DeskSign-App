/** The kinds of field a user can place on a document. */
export type FieldType = 'signature' | 'initials' | 'name' | 'email' | 'date' | 'text' | 'checkbox';

/**
 * A field placed on the document.
 *
 * Position and size are stored **normalized** (0..1) relative to the page they
 * sit on, with a top-left origin. This keeps fields correct across zoom levels
 * and window sizes, and makes embedding into the PDF a direct multiply by the
 * page's PDF dimensions — no live DOM measurement needed at signing time.
 */
export interface SignatureField {
  id: number;
  type: FieldType;
  /** 1-based page number. */
  page: number;
  /** Normalized left (0..1). */
  x: number;
  /** Normalized top (0..1). */
  y: number;
  /** Normalized width (0..1). */
  w: number;
  /** Normalized height (0..1). */
  h: number;
  /** Data-URL image (drawn/uploaded signature) or text value. */
  value?: string;
  /** Checkbox state. */
  checked?: boolean;
  /** Whether the field must be completed before finishing. */
  required: boolean;
}

/** Static metadata describing each field type. */
export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string;
  /** Tailwind text color class for the sidebar/legend. */
  color: string;
  /** Tailwind border color class. */
  borderColor: string;
  /** Accent hex used for the placed-field outline. */
  accent: string;
  /** Default on-screen size in CSS px (converted to normalized on drop). */
  defaultPx: { w: number; h: number };
  /** Whether the field is required by default. */
  requiredByDefault: boolean;
}

export const FIELD_TYPES: readonly FieldTypeMeta[] = [
  {
    type: 'signature',
    label: 'Signature',
    icon: 'pi-pencil',
    color: 'text-blue-500',
    borderColor: 'border-blue-500',
    accent: '#3b82f6',
    defaultPx: { w: 220, h: 64 },
    requiredByDefault: true,
  },
  {
    type: 'initials',
    label: 'Initials',
    icon: 'pi-verified',
    color: 'text-purple-500',
    borderColor: 'border-purple-500',
    accent: '#a855f7',
    defaultPx: { w: 96, h: 56 },
    requiredByDefault: true,
  },
  {
    type: 'name',
    label: 'Full Name',
    icon: 'pi-user',
    color: 'text-cyan-600',
    borderColor: 'border-cyan-500',
    accent: '#0891b2',
    defaultPx: { w: 220, h: 40 },
    requiredByDefault: false,
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'pi-envelope',
    color: 'text-teal-600',
    borderColor: 'border-teal-500',
    accent: '#0d9488',
    defaultPx: { w: 240, h: 40 },
    requiredByDefault: false,
  },
  {
    type: 'date',
    label: 'Date Signed',
    icon: 'pi-calendar',
    color: 'text-orange-500',
    borderColor: 'border-orange-500',
    accent: '#f97316',
    defaultPx: { w: 150, h: 40 },
    requiredByDefault: false,
  },
  {
    type: 'text',
    label: 'Text',
    icon: 'pi-align-left',
    color: 'text-green-600',
    borderColor: 'border-green-500',
    accent: '#16a34a',
    defaultPx: { w: 220, h: 44 },
    requiredByDefault: false,
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: 'pi-check-square',
    color: 'text-rose-500',
    borderColor: 'border-rose-500',
    accent: '#f43f5e',
    defaultPx: { w: 30, h: 30 },
    requiredByDefault: false,
  },
];

export const FIELD_META: Record<FieldType, FieldTypeMeta> = FIELD_TYPES.reduce(
  (acc, meta) => {
    acc[meta.type] = meta;
    return acc;
  },
  {} as Record<FieldType, FieldTypeMeta>,
);

/** Minimum normalized size a field may be resized to (avoids zero-size fields). */
export const MIN_FIELD_NORM = 0.02;

/** True for field types whose value is free text typed inline. */
export function isTextInput(type: FieldType): boolean {
  return type === 'text' || type === 'name' || type === 'email';
}
