"use client";

import { RadioGroup, Radio } from "@heroui/radio";
import { useState } from "react";
import { validateField } from "./types";

interface GenderFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function GenderField({ value, onChange }: GenderFieldProps) {
  const [touched, setTouched] = useState(false);
  const error = touched ? validateField("gender", value) : null;

  return (
    <RadioGroup
      label="Gender"
      isRequired
      value={value ? value.toLowerCase() : ""}
      isInvalid={!!error}
      errorMessage={error}
      onValueChange={(val) => {
        onChange(val);
        setTouched(true);
      }}
      orientation="horizontal"
    >
      {GENDER_OPTIONS.map((opt) => (
        <Radio key={opt.value} value={opt.value}>
          {opt.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}
