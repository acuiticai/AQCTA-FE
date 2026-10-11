import React, { useEffect, useRef, useState } from "react";

import PortalLayout, { PageHeading } from "../../layouts/PortalLayout";
import { Card, CardHeader, IconTile } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { PasswordField } from "../../components/ui/Field";
import { DefinitionList } from "../../components/ui/DetailBlocks";
import StatusPill from "../../components/ui/StatusPill";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";
import {
  AwardIcon,
  DocumentIcon,
  FileIcon,
  SettingsIcon,
} from "../../components/ui/icons";
import { useAccount } from "../../context/AccountContext";
import CustomerProfileServices from "../../services/profileService";
import {
  getCustomerAccount,
  getCustomerToken,
} from "../../utils/session";

const dash = (value) => {
  const text = String(value ?? "").trim();
  return text || "—";
};

const initialsOf = (name = "") => {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "PC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const syncSessionAccount = (signIn, data = {}) => {
  const token = getCustomerToken();
  if (!token || typeof signIn !== "function") return;
  signIn({
    token,
    account: {
      ...(getCustomerAccount() || {}),
      ...data,
      signature: data.signature ?? getCustomerAccount()?.signature ?? "",
      companyChop: data.companyChop ?? getCustomerAccount()?.companyChop ?? "",
    },
  });
};

/**
 * Upload-only company chop / stamp control (profile preview + replace).
 */
function CompanyChopPad({
  value = "",
  onChange,
  disabled = false,
  profileChop = "",
}) {
  const fileRef = useRef(null);
  const saved = String(profileChop || "").trim();
  const [mode, setMode] = useState(saved ? "saved" : "upload");
  const [uploadError, setUploadError] = useState("");
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    const profile = String(profileChop || "").trim();
    if (!profile) return;
    seededRef.current = true;
    setMode("saved");
    if (!value) onChange?.(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileChop]);

  const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError("");

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setUploadError("Use a PNG or JPEG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("That image is larger than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setMode("upload");
      onChange?.(String(reader.result || ""));
    };
    reader.onerror = () => setUploadError("That image could not be read.");
    reader.readAsDataURL(file);
  };

  const usingSaved = mode === "saved" && Boolean(value || saved);
  const preview = value || saved;

  return (
    <div className="epc-sig">
      <div className="epc-sig__head">
        <div>
          <p className="epc-doc__title">Company chop</p>
          <p className="epc-doc__meta">
            {usingSaved
              ? "Using the company chop saved on your profile. Change it below to upload a different one."
              : "Upload a PNG or JPEG of your company stamp / chop (up to 2MB)."}
          </p>
        </div>
        <div className="epc-sig__tabs" role="tablist">
          {saved ? (
            <button
              type="button"
              role="tab"
              aria-selected={mode === "saved"}
              disabled={disabled}
              className={`epc-sig__tab${mode === "saved" ? " is-active" : ""}`}
              onClick={() => {
                setUploadError("");
                setMode("saved");
                onChange?.(saved);
              }}
            >
              Profile
            </button>
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            disabled={disabled}
            className={`epc-sig__tab${mode === "upload" ? " is-active" : ""}`}
            onClick={() => {
              setUploadError("");
              setMode("upload");
              if (usingSaved) onChange?.("");
            }}
          >
            Upload
          </button>
        </div>
      </div>

      <div className="epc-sig__drop">
        {preview && (usingSaved || mode === "upload") ? (
          <img
            src={preview}
            alt="Company chop"
            className="epc-sig__preview epc-profile__chop-img"
          />
        ) : (
          <p className="epc-section__desc">PNG or JPEG, up to 2MB.</p>
        )}
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          {preview ? "Choose a different image" : "Choose an image"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={onFile}
        />
      </div>

      {uploadError ? (
        <p className="epc-field__error" role="alert">
          {uploadError}
        </p>
      ) : null}

      <div className="epc-sig__foot">
        <span>
          {value
            ? usingSaved
              ? "Using your profile company chop."
              : "Company chop ready to save."
            : "No company chop yet."}
        </span>
        <button
          type="button"
          className="epc-sig__clear"
          disabled={disabled || !value}
          onClick={() => {
            setUploadError("");
            if (usingSaved) {
              setMode("upload");
              onChange?.("");
              return;
            }
            onChange?.("");
          }}
        >
          {usingSaved ? "Remove" : "Clear"}
        </button>
      </div>
    </div>
  );
}

function MarkPreview({ src, alt, kind = "signature", hint }) {
  return (
    <div className={`epc-profile__mark epc-profile__mark--${kind}`}>
      <div className="epc-profile__mark-frame">
        <img src={src} alt={alt} className="epc-profile__mark-img" />
        <span className="epc-profile__mark-badge">On file</span>
      </div>
      {hint ? <p className="epc-section__desc">{hint}</p> : null}
    </div>
  );
}

export default function ProfileSettings() {
  const { signIn } = useAccount();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [signature, setSignature] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [editingSignature, setEditingSignature] = useState(false);

  const [companyChop, setCompanyChop] = useState("");
  const [savingChop, setSavingChop] = useState(false);
  const [chopMessage, setChopMessage] = useState("");
  const [chopError, setChopError] = useState("");
  const [editingChop, setEditingChop] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await CustomerProfileServices.getMyProfile();
        const data = res?.data?.data || null;
        if (!cancelled) {
          setProfile(data);
          setSignature("");
          setCompanyChop("");
          setEditingSignature(!data?.signature);
          setEditingChop(!data?.companyChop);
        }
      } catch (err) {
        if (!cancelled) {
          setProfile(null);
          setError(
            err?.response?.data?.message ||
              "Could not load your profile. Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveSignature = async () => {
    if (!signature) {
      setSignatureError("Draw or upload a signature before saving.");
      return;
    }
    setSavingSignature(true);
    setSignatureError("");
    setSignatureMessage("");
    try {
      const res = await CustomerProfileServices.updateMySignature({
        signatureDataUrl: signature,
      });
      const data = res?.data?.data || {};
      setProfile((prev) => ({ ...(prev || {}), ...data }));
      setSignature("");
      setEditingSignature(false);
      setSignatureMessage("Signature saved.");
      syncSessionAccount(signIn, data);
    } catch (err) {
      setSignatureError(
        err?.response?.data?.message ||
          "Could not save the signature. Please try again.",
      );
    } finally {
      setSavingSignature(false);
    }
  };

  const handleSaveCompanyChop = async () => {
    if (!companyChop) {
      setChopError("Upload a company chop before saving.");
      return;
    }
    setSavingChop(true);
    setChopError("");
    setChopMessage("");
    try {
      const res = await CustomerProfileServices.updateMyCompanyChop({
        companyChopDataUrl: companyChop,
      });
      const data = res?.data?.data || {};
      setProfile((prev) => ({ ...(prev || {}), ...data }));
      setCompanyChop("");
      setEditingChop(false);
      setChopMessage("Company chop saved.");
      syncSessionAccount(signIn, data);
    } catch (err) {
      setChopError(
        err?.response?.data?.message ||
          "Could not save the company chop. Please try again.",
      );
    } finally {
      setSavingChop(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    const fieldErrors = {};
    if (!currentPassword) {
      fieldErrors.currentPassword = "Enter your current password.";
    }
    if (!newPassword || newPassword.length < 8) {
      fieldErrors.newPassword = "New password must be at least 8 characters.";
    }
    if (newPassword !== confirmPassword) {
      fieldErrors.confirmPassword = "New passwords do not match.";
    }
    setPasswordFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setPasswordError("");
      setPasswordMessage("");
      return;
    }

    setSavingPassword(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      await CustomerProfileServices.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFieldErrors({});
      setPasswordMessage("Password updated successfully.");
    } catch (err) {
      const field = err?.response?.data?.field;
      const message =
        err?.response?.data?.message ||
        "Could not update the password. Please try again.";
      if (field) {
        setPasswordFieldErrors({ [field]: message });
        setPasswordError("");
      } else {
        setPasswordError(message);
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <PortalLayout
        crumbs={[
          { label: "Customer Portal" },
          { label: "Profile Settings" },
        ]}
      >
        <div className="epc-placeholder">
          <p className="epc-placeholder__title">Loading profile…</p>
        </div>
      </PortalLayout>
    );
  }

  if (!profile) {
    return (
      <PortalLayout
        crumbs={[
          { label: "Customer Portal" },
          { label: "Profile Settings" },
        ]}
      >
        <div className="epc-placeholder">
          <p className="epc-placeholder__title">Profile unavailable</p>
          <p className="epc-placeholder__text">
            {error || "Your company profile could not be loaded."}
          </p>
        </div>
      </PortalLayout>
    );
  }

  const contacts = Array.isArray(profile.contacts) ? profile.contacts : [];
  const savedSignature = String(profile.signature || "").trim();
  const savedChop = String(profile.companyChop || "").trim();
  const companyTitle = profile.companyName || profile.name || "Your company";
  const loginEmail = profile.email || profile.companyEmail || "";

  return (
    <PortalLayout
      crumbs={[
        { label: "Customer Portal" },
        { label: "Profile Settings" },
      ]}
    >
      <div className="epc-profile">
        <PageHeading
          title="Profile Settings"
          subtitle="Company details on file with AQCTA, plus the marks and password used in this portal."
        />

        <section className="epc-profile__hero" aria-label="Company overview">
          <div className="epc-profile__hero-main">
            <div className="epc-profile__avatar" aria-hidden="true">
              {initialsOf(companyTitle)}
            </div>
            <div className="epc-profile__hero-copy">
              <p className="epc-profile__eyebrow">Customer account</p>
              <h2 className="epc-profile__company">{companyTitle}</h2>
              <p className="epc-profile__hero-meta">
                {[loginEmail, profile.phone].filter(Boolean).join(" · ") ||
                  "Portal login details"}
              </p>
            </div>
          </div>
          <div className="epc-profile__hero-side">
            <StatusPill status={profile.status || "Active"} />
            <div className="epc-profile__readiness" aria-label="Document marks">
              <span
                className={`epc-profile__chip${
                  savedSignature ? " is-ready" : ""
                }`}
              >
                {savedSignature ? "Signature ready" : "Add signature"}
              </span>
              <span
                className={`epc-profile__chip${savedChop ? " is-ready" : ""}`}
              >
                {savedChop ? "Chop ready" : "Add company chop"}
              </span>
            </div>
          </div>
        </section>

        <div className="epc-profile__meta">
          <article className="epc-profile__meta-item">
            <span className="epc-profile__meta-label">Client type</span>
            <span className="epc-profile__meta-value">
              {dash(profile.clientType)}
            </span>
          </article>
          <article className="epc-profile__meta-item">
            <span className="epc-profile__meta-label">Registration No.</span>
            <span className="epc-profile__meta-value">
              {dash(profile.registrationNumber)}
            </span>
          </article>
          <article className="epc-profile__meta-item">
            <span className="epc-profile__meta-label">Login email</span>
            <span className="epc-profile__meta-value">{dash(loginEmail)}</span>
          </article>
          <article className="epc-profile__meta-item">
            <span className="epc-profile__meta-label">Phone</span>
            <span className="epc-profile__meta-value">
              {dash(profile.phone)}
            </span>
          </article>
        </div>

        <div className="epc-detailgrid epc-profile__grid">
          <div className="epc-detailcol">
            <p className="epc-profile__section-label">Company details</p>

            <Card className="epc-profile__card">
              <CardHeader
                title="Company"
                subtitle="Registered company information"
                action={<IconTile icon={AwardIcon} tone="brand" />}
              />
              <DefinitionList
                items={[
                  { label: "Company Name", value: dash(profile.companyName) },
                  {
                    label: "Display Name",
                    value: dash(profile.customerDisplayName),
                  },
                  { label: "Client Type", value: dash(profile.clientType) },
                  {
                    label: "Registration No.",
                    value: dash(profile.registrationNumber),
                  },
                  { label: "TIN", value: dash(profile.companyTIN) },
                  {
                    label: "Company Email",
                    value: dash(profile.companyEmail || profile.email),
                  },
                  { label: "Website", value: dash(profile.website) },
                  {
                    label: "Type of Business",
                    value: dash(profile.typeOfBusiness),
                  },
                  {
                    label: "Nature of Business",
                    value: dash(profile.natureOfBusiness),
                  },
                  {
                    label: "Years in Business",
                    value: dash(profile.yearsInBusiness),
                  },
                  {
                    label: "Country of Incorporation",
                    value: dash(profile.countryOfIncorporation),
                  },
                ]}
              />
            </Card>

            <Card className="epc-profile__card">
              <CardHeader
                title="Address & phones"
                subtitle="Primary address and contact numbers"
                action={<IconTile icon={DocumentIcon} tone="neutral" />}
              />
              <DefinitionList
                items={[
                  { label: "Address Label", value: dash(profile.addressLabel) },
                  {
                    label: "Street Address",
                    value: dash(profile.streetAddress),
                  },
                  { label: "City", value: dash(profile.city) },
                  {
                    label: "State / Province",
                    value: dash(profile.stateProvince),
                  },
                  { label: "Postcode", value: dash(profile.postCode) },
                  { label: "Country", value: dash(profile.country) },
                  {
                    label: "Full Address",
                    value: dash(profile.companyAddress),
                  },
                  { label: "Mobile", value: dash(profile.mobilePhone) },
                  { label: "Work Phone", value: dash(profile.workPhone) },
                  { label: "Primary Phone", value: dash(profile.phone) },
                  { label: "Fax", value: dash(profile.fax) },
                ]}
              />
            </Card>

            <p className="epc-profile__section-label">Security</p>

            <Card className="epc-profile__card epc-profile__card--security">
              <CardHeader
                title="Change Password"
                subtitle="Update the password you use to sign in"
                action={<IconTile icon={SettingsIcon} tone="neutral" />}
              />
              <form className="epc-stack" onSubmit={handleChangePassword}>
                <PasswordField
                  label="Current password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value);
                    setPasswordFieldErrors((prev) => ({
                      ...prev,
                      currentPassword: undefined,
                    }));
                  }}
                  error={passwordFieldErrors.currentPassword}
                  disabled={savingPassword}
                />
                <PasswordField
                  label="New password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setPasswordFieldErrors((prev) => ({
                      ...prev,
                      newPassword: undefined,
                    }));
                  }}
                  error={passwordFieldErrors.newPassword}
                  disabled={savingPassword}
                  placeholder="At least 8 characters"
                />
                <PasswordField
                  label="Confirm new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setPasswordFieldErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }}
                  error={passwordFieldErrors.confirmPassword}
                  disabled={savingPassword}
                />

                {passwordError ? (
                  <p className="epc-field__error" role="alert">
                    {passwordError}
                  </p>
                ) : null}
                {passwordMessage ? (
                  <p className="epc-profile__success" role="status">
                    {passwordMessage}
                  </p>
                ) : null}

                <div className="epc-form-actions epc-form-actions--end">
                  <Button
                    type="submit"
                    loading={savingPassword}
                    disabled={savingPassword}
                  >
                    Update password
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div className="epc-detailcol">
            <p className="epc-profile__section-label">Signing marks</p>

            <Card className="epc-profile__card">
              <CardHeader
                title="Portal Account"
                subtitle="Login details for this portal"
              />
              <DefinitionList
                items={[
                  {
                    label: "Account Name",
                    value: dash(profile.name || profile.companyName),
                  },
                  { label: "Login Email", value: dash(loginEmail) },
                  { label: "Phone", value: dash(profile.phone) },
                ]}
              />
            </Card>

            <Card className="epc-profile__card">
              <CardHeader
                title="E-Signature"
                subtitle="Used on quotations and acknowledgements"
                action={
                  savedSignature && !editingSignature ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingSignature(true);
                        setSignature("");
                        setSignatureMessage("");
                        setSignatureError("");
                      }}
                    >
                      Update
                    </Button>
                  ) : (
                    <IconTile icon={FileIcon} tone="brand" />
                  )
                }
              />

              {savedSignature && !editingSignature ? (
                <MarkPreview
                  src={savedSignature}
                  alt="Saved signature"
                  kind="signature"
                  hint="Saved on your profile and pre-filled on documents. You can still change it when signing."
                />
              ) : (
                <>
                  <SignaturePad
                    value={signature}
                    onChange={(next) => {
                      setSignature(next);
                      setSignatureError("");
                      setSignatureMessage("");
                    }}
                    disabled={savingSignature}
                    label="Your signature"
                    hint="Sign in the box, or upload a PNG/JPEG of your signature."
                  />
                  <div className="epc-form-actions epc-form-actions--end">
                    {savedSignature ? (
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={savingSignature}
                        onClick={() => {
                          setEditingSignature(false);
                          setSignature("");
                          setSignatureError("");
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      loading={savingSignature}
                      disabled={savingSignature || !signature}
                      onClick={handleSaveSignature}
                    >
                      Save signature
                    </Button>
                  </div>
                </>
              )}

              {signatureError ? (
                <p className="epc-field__error" role="alert">
                  {signatureError}
                </p>
              ) : null}
              {signatureMessage ? (
                <p className="epc-profile__success" role="status">
                  {signatureMessage}
                </p>
              ) : null}
            </Card>

            <Card className="epc-profile__card">
              <CardHeader
                title="Company Chop"
                subtitle="Stamp used as Co. Stamp on quotations"
                action={
                  savedChop && !editingChop ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingChop(true);
                        setCompanyChop("");
                        setChopMessage("");
                        setChopError("");
                      }}
                    >
                      Update
                    </Button>
                  ) : (
                    <IconTile icon={AwardIcon} tone="brand" />
                  )
                }
              />

              {savedChop && !editingChop ? (
                <MarkPreview
                  src={savedChop}
                  alt="Saved company chop"
                  kind="chop"
                  hint="Saved on your profile and pre-filled on documents. You can still replace it when accepting a quotation."
                />
              ) : (
                <>
                  <CompanyChopPad
                    value={companyChop}
                    onChange={(next) => {
                      setCompanyChop(next);
                      setChopError("");
                      setChopMessage("");
                    }}
                    disabled={savingChop}
                    profileChop={savedChop}
                  />
                  <div className="epc-form-actions epc-form-actions--end">
                    {savedChop ? (
                      <Button
                        variant="ghost"
                        type="button"
                        disabled={savingChop}
                        onClick={() => {
                          setEditingChop(false);
                          setCompanyChop("");
                          setChopError("");
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      loading={savingChop}
                      disabled={savingChop || !companyChop}
                      onClick={handleSaveCompanyChop}
                    >
                      Save company chop
                    </Button>
                  </div>
                </>
              )}

              {chopError ? (
                <p className="epc-field__error" role="alert">
                  {chopError}
                </p>
              ) : null}
              {chopMessage ? (
                <p className="epc-profile__success" role="status">
                  {chopMessage}
                </p>
              ) : null}
            </Card>

            <Card className="epc-profile__card">
              <CardHeader
                title="Key Contacts"
                subtitle="People AQCTA can reach"
              />
              {contacts.length === 0 ? (
                <p className="epc-section__desc">No key contacts on file.</p>
              ) : (
                <ul className="epc-profile__people">
                  {contacts.map((contact, index) => (
                    <li
                      key={`${contact.email || contact.name}-${index}`}
                      className="epc-profile__person"
                    >
                      <span className="epc-profile__person-avatar" aria-hidden>
                        {initialsOf(contact.name || "C")}
                      </span>
                      <div className="epc-profile__person-body">
                        <p className="epc-profile__person-name">
                          {dash(contact.name)}
                        </p>
                        <p className="epc-profile__person-role">
                          {dash(contact.position)}
                        </p>
                        <p className="epc-profile__person-line">
                          {[contact.email, contact.mobile || contact.phone]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
