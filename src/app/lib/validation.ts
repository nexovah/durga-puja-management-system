// Strips everything except 0-9 — use in onChange so non-digit keystrokes
// (and pasted text) never even land in the field. Shared by every
// phone-number input and Chanda's Bill Number / No. of Persons fields.
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Required: must be present AND >= 10 digits. Optional: empty is fine,
// but if anything is typed it must still be >= 10 digits (no "partial"
// phone numbers saved).
export function isPhoneValid(value: string, required: boolean): boolean {
  const digits = value.trim();
  if (digits === '') return !required;
  return digits.length >= 10;
}
