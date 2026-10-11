import React, { useEffect, useRef } from "react";

const DIGIT = /^[0-9]$/;

/**
 * Six-box one-time-passcode input.
 * Handles per-box typing, backspace stepping, arrow keys and pasting a full
 * code into any box.
 */
export default function OtpInput({
  length = 6,
  value = "",
  onChange,
  autoFocus = true,
  id = "otp",
}) {
  const refs = useRef([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const digits = Array.from({ length }, (_, index) => value[index] || "");

  const emit = (next) => {
    onChange?.(next.join("").slice(0, length));
  };

  const focusBox = (index) => {
    const target = refs.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select?.();
  };

  const handleChange = (index) => (event) => {
    const typed = event.target.value.replace(/\D/g, "");
    if (!typed) {
      const next = [...digits];
      next[index] = "";
      emit(next);
      return;
    }

    const next = [...digits];
    // Typing several characters at once (autofill) fills forward from here.
    typed.split("").forEach((char, offset) => {
      if (index + offset < length) next[index + offset] = char;
    });
    emit(next);
    focusBox(index + typed.length);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = "";
        emit(next);
      } else if (index > 0) {
        next[index - 1] = "";
        emit(next);
        focusBox(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index) => (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasted) return;
    event.preventDefault();

    const next = [...digits];
    pasted.split("").forEach((char, offset) => {
      if (index + offset < length) next[index + offset] = char;
    });
    emit(next);
    focusBox(index + pasted.length);
  };

  return (
    <div className="epc-otp">
      {digits.map((digit, index) => (
        <input
          // Fixed-length control: index is a stable identity here.
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          id={index === 0 ? id : `${id}-${index}`}
          className="epc-otp__box"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          placeholder="0"
          value={digit}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste(index)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}

export function isOtpComplete(value, length = 6) {
  return (
    typeof value === "string" &&
    value.length === length &&
    value.split("").every((char) => DIGIT.test(char))
  );
}
