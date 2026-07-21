/** The kinds of field a user can place on a document. */
export type FieldType = 'signature' | 'initials' | 'text' | 'date';

/** A field placed on the document, positioned in rendered (screen) pixels. */
export interface SignatureField {
  id: number;
  type: FieldType;
  /** X offset in px from the top-left of its page, in rendered space. */
  x: number;
  /** Y offset in px from the top-left of its page, in rendered space. */
  y: number;
  /** 1-based page number the field belongs to. */
  page: number;
  /** Data-URL image (drawn signature) or text (typed signature/initials/date). */
  value?: string;
}

/** Fixed on-screen size of a placed field, in px. */
export const FIELD_WIDTH = 200;
export const FIELD_HEIGHT = 60;
