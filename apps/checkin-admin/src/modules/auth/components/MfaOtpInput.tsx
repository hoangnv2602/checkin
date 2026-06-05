/**
 * apps/checkin-admin/src/modules/auth/components/MfaOtpInput.tsx — I-108
 *
 * 6 ô input cho TOTP code, tự focus next, paste support (1 lần).
 */
"use client";

import { useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";

interface MfaOtpInputProps {
  length?: number;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function MfaOtpInput({ length = 6, onChange, disabled }: MfaOtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function update(next: string[]) {
    setDigits(next);
    onChange(next.join(""));
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    update(next);
    if (v && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted.length === length) {
      e.preventDefault();
      const next = pasted.split("");
      update(next);
      refs.current[length - 1]?.focus();
    }
  }

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="Mã TOTP 6 số">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          aria-label={`Chữ số ${i + 1}`}
          className="h-12 w-10 text-center text-lg font-mono border border-input rounded-md bg-transparent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
