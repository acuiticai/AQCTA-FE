import React from "react";

import Button from "../../../components/ui/Button";
import { FormGrid, PasswordField, TextField } from "../../../components/ui/Field";
import { useRegistration } from "../../../context/RegistrationContext";
import { isEmail, isFilled, isUrl, validate } from "../../../utils/validation";

export default function StepCompany() {
  const { data, errors, setErrors, updateSection, goNext } = useRegistration();
  const values = data.company;

  const setField = (field) => (event) => {
    updateSection("company", { [field]: event.target.value });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = validate(values, {
      companyName: [[isFilled, "Company name is required"]],

      email: [
        [isFilled, "Email is required"],
        [isEmail, "Enter a valid email address"],
      ],
      // Optional, but still validated when the customer does fill it in.
      website: [
        [(value) => !isFilled(value) || isUrl(value), "Enter a valid website address"],
      ],
      password: [
        [isFilled, "Password is required"],
        [
          (value) => String(value).length >= 8,
          "Use at least 8 characters",
        ],
      ],
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    goNext();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormGrid>
        <TextField
          label="Company Name *"
          name="companyName"
          placeholder="Enter company name"
          value={values.companyName}
          onChange={setField("companyName")}
          error={errors.companyName}
        />
        <TextField
          label="Company Registration Number (Optional)"
          name="registrationNumber"
          placeholder="Enter registration no."
          value={values.registrationNumber}
          onChange={setField("registrationNumber")}
          error={errors.registrationNumber}
        />
        <TextField
          label="Email *"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={values.email}
          onChange={setField("email")}
          error={errors.email}
        />
        <TextField
          label="Website (Optional)"
          name="website"
          placeholder="https://company.com"
          value={values.website}
          onChange={setField("website")}
          error={errors.website}
        />
        <PasswordField
          full
          label="Password *"
          name="password"
          autoComplete="new-password"
          placeholder="Create a secure password"
          value={values.password}
          onChange={setField("password")}
          error={errors.password}
        />
      </FormGrid>

      <div className="epc-form-actions">
        <Button type="submit" block>
          Continue
        </Button>
      </div>
    </form>
  );
}
