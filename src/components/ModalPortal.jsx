import { createPortal } from "react-dom";

/** Render modals outside nested parent <form> trees to avoid accidental form submit. */
export default function ModalPortal({ children }) {
  if (typeof document === "undefined") return children;
  return createPortal(children, document.body);
}
