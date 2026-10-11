import React from "react";

import Button from "../../../components/ui/Button";
import { FormGrid, TextField } from "../../../components/ui/Field";
import FileDropzone from "../../../components/ui/FileDropzone";
import { useRegistration } from "../../../context/RegistrationContext";

export default function StepDocuments({ onSubmit, submitting }) {
  const { data, updateSection, goBack } = useRegistration();
  const values = data.documents;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.(data);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormGrid single>
        <TextField
          label="Document Title (Optional)"
          name="documentTitle"
          placeholder="Enter document title"
          value={values.title}
          onChange={(event) =>
            updateSection("documents", { title: event.target.value })
          }
        />

        <div className="epc-dropzone-slot">
          <FileDropzone
            id="company-documents"
            title="Upload company documents"
            hint="Multiple files supported"
            files={values.files}
            onFilesChange={(files) => updateSection("documents", { files })}
          />
        </div>
      </FormGrid>

      <div className="epc-form-actions">
        <Button
          type="button"
          variant="secondary"
          className="epc-form-actions__back"
          onClick={goBack}
        >
          Back
        </Button>
        <Button type="submit" grow loading={submitting}>
          Create account
        </Button>
      </div>

      <p className="epc-submit-note">
        By creating an account, your customer profile will be submitted to AQCTA.
      </p>
    </form>
  );
}
