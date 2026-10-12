import PageHeader from "./PageHeader";

export default function Page({ children, header, customClassName }) {
  return (
    <div
      className={` ${customClassName} min-h-screen overflow-x-hidden py-4 ${
        !header ? "pt-2" : "pt-3"
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
