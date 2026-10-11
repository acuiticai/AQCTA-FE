/**
 * Redirect browser to Fiuu hosted payment page via POST.
 *
 * form.action keeps amount / orderid / vcode / currency in the query so
 * Back/refresh is not a bare GET (Fiuu: "Your payment info format is not
 * correct."). Billing name, email, mobile, and description stay in POST.
 */
const INTEGRITY_QUERY_KEYS = ["amount", "orderid", "vcode", "currency"];

function buildIntegrityActionUrl(paymentUrl, formFields) {
  if (!paymentUrl) return null;
  const params = new URLSearchParams();
  INTEGRITY_QUERY_KEYS.forEach((key) => {
    const value = formFields?.[key];
    if (value != null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `${paymentUrl}?${qs}` : paymentUrl;
}

export function redirectToFiuuPayment(checkout) {
  if (!checkout) return false;

  const paymentUrl = checkout.paymentUrl || checkout.payment_url;
  const formFields = checkout.formFields || checkout.form_fields;

  if (formFields && typeof formFields === "object") {
    const tokenStatus = String(formFields.token_status ?? "").trim();
    if (!tokenStatus || tokenStatus === "0") {
      console.warn(
        "[Fiuu] token_status missing/0 — card may NOT be tokenized for recurring",
      );
    }
  }

  if (paymentUrl && formFields && typeof formFields === "object") {
    const actionUrl = buildIntegrityActionUrl(paymentUrl, formFields);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = actionUrl;
    form.acceptCharset = "UTF-8";
    form.style.display = "none";
    Object.entries(formFields).forEach(([key, value]) => {
      if (value == null) return;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    return true;
  }

  if (paymentUrl) {
    window.location.assign(paymentUrl);
    return true;
  }

  return false;
}
