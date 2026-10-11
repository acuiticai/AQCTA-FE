import React from "react";
import styled from "styled-components";

const DividerContainer = styled.div`
  width: 100%;
  height: 1px;
  background-color: ${(props) => props.color || "#e5e7eb"};
  margin: ${(props) => props.margin || "16px 0"};
  opacity: ${(props) => props.opacity || 1};
`;

const DividerWithText = styled.div`
  display: flex;
  align-items: center;
  margin: ${(props) => props.margin || "16px 0"};

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background-color: ${(props) => props.color || "#e5e7eb"};
  }

  &::before {
    margin-right: ${(props) => props.textSpacing || "16px"};
  }

  &::after {
    margin-left: ${(props) => props.textSpacing || "16px"};
  }
`;

const DividerText = styled.span`
  color: ${(props) => props.textColor || "#6b7280"};
  font-size: ${(props) => props.textSize || "14px"};
  font-weight: ${(props) => props.textWeight || "500"};
  white-space: nowrap;
`;

const Divider = ({
  variant = "line", // "line" | "text"
  text,
  color,
  margin,
  opacity,
  textColor,
  textSize,
  textWeight,
  textSpacing,
  className,
  style,
  ...props
}) => {
  if (variant === "text" && text) {
    return (
      <DividerWithText
        color={color}
        margin={margin}
        textSpacing={textSpacing}
        className={className}
        style={style}
        {...props}
      >
        <DividerText
          textColor={textColor}
          textSize={textSize}
          textWeight={textWeight}
        >
          {text}
        </DividerText>
      </DividerWithText>
    );
  }

  return (
    <DividerContainer
      color={color}
      margin={margin}
      opacity={opacity}
      className={className}
      style={style}
      {...props}
    />
  );
};

export default Divider;
