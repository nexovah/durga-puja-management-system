// The "*" that marks a mandatory field label — always in the app's theme
// orange, not the surrounding label's gray, so a required field reads
// clearly at a glance everywhere in the app.
export function RequiredMark() {
  return <span className="text-orange-600 dark:text-orange-500"> *</span>;
}
