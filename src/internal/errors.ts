/**
 * Error utilities.
 * SRP: normalize unknown throwables into Error instances.
 */

export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(String(value));
}
