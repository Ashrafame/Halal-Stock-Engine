// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- `typeof` needs the value binding
import en from './locales/en';

/** Recursively widen literal strings to `string` so locales can be translated. */
export type DeepString<T> = T extends string
  ? string
  : { [K in keyof T]: DeepString<T[K]> };

export type Dictionary = DeepString<typeof en>;
