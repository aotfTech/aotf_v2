"use client";

import { Input } from "@heroui/input";
import { useState } from "react";
import { validateField } from "./types";

interface QualificationFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export default function QualificationField({
  value,
  onChange,
}: QualificationFieldProps) {
  const [touched, setTouched] = useState(false);
  const error = touched ? validateField("qualification", value) : null;

  return (
    <Input
      label="Highest Qualification"
      isRequired
      maxLength={15}
      value={value}
      isInvalid={!!error}
      errorMessage={error}
      onValueChange={onChange}
      onBlur={() => setTouched(true)}
    />
  );
}
