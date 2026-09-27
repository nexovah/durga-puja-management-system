/**
 * DateInput — a thin wrapper around <input type="date"> that forces the
 * DD/MM/YYYY display format by setting lang="en-IN" (Indian English).
 *
 * The value/onChange contract is identical to a plain date input:
 * value is always an ISO yyyy-mm-dd string internally (what the browser
 * stores), but the user sees and types DD/MM/YYYY in the picker.
 */
import React from 'react';

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function DateInput({ className, ...props }: DateInputProps) {
  return (
    <input
      type="date"
      lang="en-IN"
      className={className}
      {...props}
    />
  );
}
