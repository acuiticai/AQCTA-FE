import React from "react";
import { useDropzone } from "react-dropzone";
import { CloudUpload as CloudUploadIcon } from "@mui/icons-material";

const LogoUploader = ({ logo, setLogo }) => {
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
    },
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        setLogo({
          preview: reader.result,
          file: file,
        });
      };
      reader.readAsDataURL(file);
    },
    maxSize: 5242880,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className="mt-1 flex justify-center rounded-lg border border-dashed border-gray-900/25"
      >
        <div className="text-center">
          <CloudUploadIcon className="mx-auto h-12 w-12 text-gray-300" />
          <div className="mt-4 flex text-sm leading-6 text-gray-600">
            <span className="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600">
              Upload a file
            </span>
            <input {...getInputProps()} />
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs leading-5 text-gray-600">
            PNG, JPG, GIF up to 5MB
          </p>
        </div>
      </div>
      {logo && (
        <div className="mt-4">
          <img src={logo.preview} alt="Preview" className="max-h-32 mx-auto" />
        </div>
      )}
    </div>
  );
};

export default LogoUploader;
