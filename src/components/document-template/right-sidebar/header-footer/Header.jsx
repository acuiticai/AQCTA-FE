import LogoUploader from "@/pages/DocumentTemplate/components/LogoUploader";
import { customInputsData } from "@/pages/DocumentTemplate/data/data-index";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";
import { CustomInput } from "../../ui/Input";
import { useForm } from "react-hook-form";
import React from "react";

function HeaderRightBar() {
  const { logo, setLogo, documentType, setHeaderData, headerData } =
    useDocumentConext();
  const inputsData = customInputsData[documentType];

  const {
    register,
    reset,
    formState: { errors },
    watch,
  } = useForm({
    defaultValues: headerData, // Set initial values from headerData
  });

  // Watch all fields and update parent component in real-time
  React.useEffect(() => {
    const subscription = watch((data) => {
      setHeaderData(data);
    });
    return () => subscription.unsubscribe();
  }, [watch, setHeaderData]);

  // Handle reset with confirmation
  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all fields?")) {
      reset({}); // Reset form to empty values
      setHeaderData({}); // Reset parent state
    }
  };
  return (
    <div className="p-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Document Logo
        </label>
        <LogoUploader logo={logo} setLogo={setLogo} />
      </div>

      {inputsData && (
        <div
          style={{ scrollbarWidth: "thin" }}
          className="h-[70vh] overflow-auto mx-auto my-4 p-6 pb-28"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {inputsData.map((field) => (
              <div
                key={field.id}
                className={field.type === "textarea" ? "md:col-span-2" : ""}
              >
                <CustomInput
                  {...field}
                  register={register}
                  error={errors[field.id]}
                  defaultValue={headerData[field.id]} // Pass default value to each input
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default HeaderRightBar;
