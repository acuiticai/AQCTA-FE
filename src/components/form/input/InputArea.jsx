import React from "react";
import { Input } from "@windmill/react-ui";

const InputArea = ({
  register,
  defaultValue,
  required,
  name,
  label,
  type,
  autoComplete,
  placeholder,
  value,
  onChange,
  icon,
  endIcon,
}) => {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {icon && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '12px',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}>
          {icon}
        </div>
      )}
      <Input
        // {...register(`${name}`, {
        //   required: required ? `${label} is required!` : false,
        // })}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
        name={name}
        autoComplete={autoComplete}
        className="mr-2 h-12 p-2"
        style={{
          paddingLeft: icon ? '40px' : '12px',
          paddingRight: endIcon ? '44px' : undefined,
        }}
      />
      {endIcon && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: '20px',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {endIcon}
        </div>
      )}
    </div>
  );
};

export default InputArea;
