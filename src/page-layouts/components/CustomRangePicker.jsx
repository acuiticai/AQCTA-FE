export default function CustomRangePicker({ ...props }) {
  return (
    <div
      className={`w-full ${
        props.error && props.shouldShowError
          ? "border-[2px] border-red-500 outline-none"
          : "border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
      }  rounded-[12px] shadow-sm px-[16px] py-[8px] ${
        props.theme === "light" ? "transparent" : "bg-gray-100"
      } ${props.className} ${
        props.inActive && "pointer-events-none text-p-blue-dark"
      }`}
    >
      <div className="flex justify-between relative">
        <input type="range" className="w-[100%]" {...props} />
        <input
          type="number"
          className="w-[20%] text-center border-none outline-none bg-transparent text-[10px] font-bold text-gray-500"
          value={props.value}
          onChange={props.onChange}
          onBlur={(e) => {
            if (e.target.value < props.min) {
              props.onChange({
                target: {
                  value: props.min,
                },
              });
            } else if (e.target.value > props.max) {
              props.onChange({
                target: {
                  value: props.max,
                },
              });
            }
          }}
        />
      </div>
    </div>
  );
}
