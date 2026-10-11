/**
 * AQCTA Customer Portal — public surface.
 *
 * The portal is a self-contained product inside the same Vite app: its own
 * branding tokens, stylesheet, component kit and routes. Nothing here depends
 * on the admin theme, the admin Redux store or an authenticated session.
 */

export { default as CustomerRoutes } from "./routes/CustomerRoutes";
export { customerPath, CUSTOMER_BASE } from "./routes/paths";

export {
  CustomerBrandingProvider,
  useBranding,
  brandConfig,
  brandTokens,
} from "./branding";

export { default as SplitAuthLayout } from "./components/layout/SplitAuthLayout";
export { default as CenteredAuthLayout } from "./components/layout/CenteredAuthLayout";
export { default as BrandPanel } from "./components/layout/BrandPanel";
export {
  default as AuthHeader,
  SecureNote,
} from "./components/layout/AuthHeader";

export { default as Button } from "./components/ui/Button";
export {
  Field,
  TextField,
  PasswordField,
  SelectField,
  TextareaField,
  PhoneField,
  FormGrid,
} from "./components/ui/Field";
export { default as StepChevrons } from "./components/ui/StepChevrons";
export { default as OtpInput, isOtpComplete } from "./components/ui/OtpInput";
export { default as FileDropzone } from "./components/ui/FileDropzone";
