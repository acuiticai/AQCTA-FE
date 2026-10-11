import styled from "styled-components";

const FullContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
`;

const LoaderContainer = styled.div`
  border-top: 2px solid ${(props) => props.color || "#84cc16"};
  border-left: 2px solid ${(props) => props.color || "#84cc16"};
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export default function Loader({ fullContainer = false, color }) {
  return fullContainer ? (
    <FullContainer>
      <LoaderContainer color={color} />
    </FullContainer>
  ) : (
    <LoaderContainer color={color} />
  );
}
