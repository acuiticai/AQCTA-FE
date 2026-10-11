import styled from "styled-components";

const EmptyCell = styled.div`
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  width: 100%;
  display: flex;
  color: var(--placeholder-text);
`;

export const EmptyCellContainer = ({ children }) => {
  return <EmptyCell>{children || "N/A"}</EmptyCell>;
};
