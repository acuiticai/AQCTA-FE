export default function TabButton({
  title,
  activeTab,
  handleTabChange,
  name,
  ...props
}) {
  return (
    <button
      {...props}
      className={`p-2 cursor-pointer border-l-0 border-r-0 border-b-2 shadow-none${
        activeTab === name
          ? "text-p-blue border-p-blue font-bold border-b-2 border-b-p-blue"
          : "text-gray-500"
      }`}
      onClick={() => handleTabChange(name)}
    >
      {title}
    </button>
  );
}
