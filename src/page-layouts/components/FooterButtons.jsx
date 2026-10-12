import Button from "./Button";

export default function FooterButtons({
  onSave,
  onCancel,
  buttonColor,
  loading,
  disableSubmission,
  showCancelButton = true,
  cancelButtonText = "Cancel",
  saveButtonText = "Save",
  extendedButtons = [],
}) {
  const resolvedButtonColor = buttonColor || "var(--p-blue)";

  return (
    <div className="flex justify-end items-center gap-3 mt-8">
      <div className="flex space-x-3 gap-2">
        {showCancelButton && (
          <Button
            type="button"
            secondary
            onClick={onCancel}
            className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors !shadow-none"
          >
            {cancelButtonText}
          </Button>
        )}
        <Button
          type="submit"
          disabled={disableSubmission}
          onClick={onSave}
          style={{
            backgroundColor: resolvedButtonColor,
            color: "var(--buttons-text-color, #ffffff)",
          }}
          className="!min-w-0 px-6 py-2 h-[40px] rounded-lg !shadow-none hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading && (
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          )}
          {loading ? "Saving..." : saveButtonText}
        </Button>
        {extendedButtons.map((button) => (
          <Button
            {...button}
            key={button.text}
            onClick={button.onClick}
            className={button.className}
            style={{
              backgroundColor: resolvedButtonColor,
              ...button.style,
            }}
          >
            {button.text}
          </Button>
        ))}
      </div>
    </div>
  );
}
