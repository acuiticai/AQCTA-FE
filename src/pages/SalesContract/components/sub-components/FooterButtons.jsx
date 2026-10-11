export default function FooterButtons({ onSave, onCancel }) {
  return (
    <div className="flex justify-end gap-4 pt-4">
      <button
        onClick={onCancel}
        className="border bg-white p-2 rounded-md hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
      type="submit"
        // onClick={onSave}
        className="bg-[#98b93c] p-2 hover:bg-[#86a235] text-white rounded-md"
      >
        Save
      </button>
    </div>
  );
}
