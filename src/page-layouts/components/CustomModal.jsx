import React, { useEffect, useState } from "react";
import { Modal } from "react-responsive-modal";
import "react-responsive-modal/styles.css";
import styled from "styled-components";
import { Button } from "../index";

// Styled scrollable content with custom scrollbar
const ScrollableContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(100vh - 200px);
  /* Room for focus rings on inputs — avoid clipping left/right borders */
  padding: 4px 12px 8px 4px;
  margin: 0 -4px;

  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 4px;
  }

  scrollbar-width: thin;
`;

// Styled footer row for actions
const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding: 12px 0 0 0;
`;

const ModalTitle = styled.h2`
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 700;
`;

export const CustomModal = ({
  open,
  title = "",
  children,
  actions = [],
  initialState = {},
  onClose = () => {},
  onOpen = () => {},
  onConfirm = () => {},
  loading = false,
  height = "auto",
  width = "400px",
  disabled = false,
  style = {},
  contentStyles = {},
  zIndex,
  showActions = true,
  confirmText = "Confirm",
  savingText = "Loading...",
  // Forwarded to react-responsive-modal. focusTrapped defaults true (unchanged);
  // pass false to stop it auto-focusing the first field on open, which otherwise
  // scrolls a long page to the top.
  focusTrapped = true,
  blockScroll = true,
}) => {
  const [state, setState] = useState(initialState);

  if (showActions && !actions?.length) {
    actions = [
      {
        label: "Cancel",
        secondary: true,
        onClick: onClose,
      },
      {
        label: loading ? savingText : confirmText,
        primary: true,
        onClick: onConfirm,
        disabled: loading || disabled,
      },
    ];
  }

  useEffect(() => {
    if (open) {
      setState(initialState);
      onOpen();
    }
    // eslint-disable-next-line
  }, [open]);

  return (
    <Modal
      zIndex={zIndex}
      open={open}
      onClose={onClose}
      focusTrapped={focusTrapped}
      blockScroll={blockScroll}
      classNames={{
        modal: `custom-page-layout-modal ${zIndex ? `custom-z-index` : ""}`,
      }}
      center
      styles={{
        modal: {
          height,
          minWidth: width,
          borderRadius: "16px",
          padding: "32px",
          maxHeight: "90vh",
          overflow: "hidden",
          zIndex: zIndex,
          ...style,
        },
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          justifyContent: "space-between",
          minHeight: "200px",
          maxHeight: "80vh",
        }}
      >
        {title && <ModalTitle>{title}</ModalTitle>}
        <ScrollableContent style={contentStyles}>
          <div>{children}</div>
        </ScrollableContent>
        <ModalFooter>
          {actions.map((action, idx) => (
            <Button
              key={idx}
              onClick={() => action.onClick(state, setState)}
              disabled={action.disabled || loading}
              {...action}
            >
              {action.label}
            </Button>
          ))}
        </ModalFooter>
      </div>
    </Modal>
  );
};
