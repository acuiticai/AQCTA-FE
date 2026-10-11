import React from "react";
import { useForm } from "react-hook-form";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CustomInput from "./CustomInput";
import { inputFieldsProforma } from "../../data/data-index";

const FormHeaderComponent = ({ setHeaderData, headerData }) => {
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
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-md">
      <div className="mb-6 py-2 px-5">
        <h2 className="text-2xl font-bold border-b text-gray-800">
          Document Header Information
        </h2>
      </div>
      <div
        style={{ scrollbarWidth: "thin" }}
        className="h-[70vh] overflow-auto mx-auto my-4 p-6 pb-28"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {inputFieldsProforma.map((field) => (
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
        <div className="flex justify-end space-x-4 mt-6">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Reset
          </button>
        </div>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default FormHeaderComponent;
