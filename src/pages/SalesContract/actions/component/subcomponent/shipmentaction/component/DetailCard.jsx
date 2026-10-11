const DetailsCard = ({ title, details }) => {
  return (
    <div className="p-6 bg-[#F9F9FA] rounded-xl shadow-md flex flex-col min-h-full">
      {/* ✅ Title */}
      <h3 className="font-bold text-lg mb-3">{title}</h3>
      
      {/* ✅ Details List */}
      <ul className="text-sm text-gray-600 flex-grow">
        {Object.entries(details).map(([key, value]) => (
          <li key={key} className="flex justify-between py-1">
            <span className="text-gray-500">{key}:</span> 
            <span className="font-semibold text-black">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DetailsCard;
