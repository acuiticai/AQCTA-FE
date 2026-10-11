import React from "react";
import { useForm } from "react-hook-form";
import { Delete as DeleteIcon } from "@mui/icons-material";
import { CustomInput } from "./Input";
import EditableLabel from "../right-sidebar/content/UpdateLabels";

const DynamicInputsForm = ({
  title = "Entry Details",
  subtitle = "Manage entry fields",
  isVisible,
  setIsVisible,
  entries,
  setEntries,
  onAddContent,
  inputFields = [],
  section, // Add this prop to identify which section this form belongs to
  className = "",
  cardClassName = "space-y-3 p-4 bg-white rounded-lg shadow-sm border border-gray-200",
}) => {
  const {
    register,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: entries || {},
  });

  React.useEffect(() => {
    const subscription = watch((value) => {
      setEntries(value);
    });
    return () => subscription.unsubscribe();
  }, [watch, setEntries]);

  return (
    <div className={`space-y-4 overflow-y-auto ${className}`}>
      <div className={cardClassName}>
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-medium text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
          {onAddContent && (
            <button
              className="bg-[#7dbc31] text-white p-1 rounded-md"
              onClick={onAddContent}
            >
              Add Content
            </button>
          )}
        </div>

        {isVisible && (
          <div className="relative">
            {setIsVisible && (
              <button
                onClick={() => setIsVisible(false)}
                className="absolute hover:bg-red-200 text-red-600 rounded-md top-0 right-1"
                title="Remove Content"
              >
                <DeleteIcon />
              </button>
            )}

            <div className="space-y-4 mt-4">
              <div className="space-y-3 p-3 bg-gray-50 rounded-md">
                <div className="grid grid-cols-1 gap-4">
                  {inputFields.map((fieldConfig) => (
                    <div key={fieldConfig.id} className="space-y-1">
                      <EditableLabel
                        section={section}
                        fieldId={fieldConfig.id}
                        className="mb-1"
                      />
                      <CustomInput
                        {...fieldConfig}
                        register={register}
                        error={errors[fieldConfig.id]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicInputsForm;
