import React from "react";
import { Controller } from "react-hook-form";

const DocumentForm = ({ control, errors }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Document Type
      </label>
      <Controller
        name="documentType"
        control={control}
        rules={{ required: "Document type is required" }}
        render={({ field }) => (
          <div>
            <select
              {...field}
              className="w-full p-3 rounded-lg border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors duration-200"
            >
              <option value="">Select type</option>
              {[
                "Work order",
                "Proforma Invoice",
                "Commercial Invoice",
                "Credit Note",
                "Debit Note",
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.documentType && (
              <p className="mt-2 text-sm text-red-600">
                {errors.documentType.message}
              </p>
            )}
          </div>
        )}
      />
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Template Name
      </label>
      <Controller
        name="templateName"
        control={control}
        rules={{ required: "Template name is required" }}
        render={({ field }) => (
          <div>
            <input
              {...field}
              type="text"
              className="w-full rounded-lg p-3 border border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 transition-colors duration-200"
              placeholder="Enter template name"
            />
            {errors.templateName && (
              <p className="mt-2 text-sm text-red-600">
                {errors.templateName.message}
              </p>
            )}
          </div>
        )}
      />
    </div>
  </div>
);

export default DocumentForm;
