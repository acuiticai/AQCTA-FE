import { PageHeader } from "../index";

export default function Page({ children, header, customClassName }) {
  return (
    <div
      className={` ${customClassName} min-h-screen overflow-x-hidden p-5 sm:p-6 ${
        !header ? "pt-3" : "pt-5"
      }`}
      style={{
        background: "transparent",
        fontFamily: '"Plus Jakarta Sans", "Outfit", "Segoe UI", sans-serif',
      }}
    >
      {header && <PageHeader {...header} />}
      {children}
    </div>
  );
}
