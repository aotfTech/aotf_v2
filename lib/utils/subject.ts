/**
 * Formats a subject value to a human-readable label.
 *
 * Handles two cases:
 *  - Legacy keys (e.g. "mathematics", "english_literature") → "Mathematics", "English Literature"
 *  - New labels already stored from the form (e.g. "Mathematics") → returned as-is
 *
 * Detection: if the value contains a space or starts with an uppercase letter,
 * it's already a label. Otherwise treat as a snake_case key.
 */
export function formatSubjectLabel(value: string): string {
  if (!value) return "";
  // Already a human-readable label (has spaces, or starts uppercase, or mixed case)
  const alreadyLabel = /[A-Z]/.test(value) || value.includes(" ");
  if (alreadyLabel) return value;
  // Legacy key: split on underscore, capitalise each word, join with space
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatSubjectsList(subjects: string[]): string {
  if (!subjects || subjects.length === 0) return "";
  return subjects.map(formatSubjectLabel).join(", ");
}
