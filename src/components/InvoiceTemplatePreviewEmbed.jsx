import { scopeTemplateHtmlForEmbed } from "@/utils/invoiceContractMapper";
import {
  INVOICE_PREVIEW_PAGE_STYLES,
  INVOICE_PREVIEW_SAFETY_STYLES,
} from "@/utils/invoiceOnScreenPreviewStyles";

/**
 * Renders a full invoice document template HTML for on-screen preview — same layout
 * as view-customer-invoice (A4 page, scoped template CSS, table border safety styles).
 */
export default function InvoiceTemplatePreviewEmbed({ html, className = "" }) {
  if (!html) return null;

  const wrapClass = "tpl-doc-body";
  const { styles: scopedStyles, body } = scopeTemplateHtmlForEmbed(html, wrapClass);

  return (
    <div className={`tpl-doc-page-wrap ${className}`.trim()}>
      <style>{INVOICE_PREVIEW_PAGE_STYLES}</style>
      <div className="tpl-doc-page invoice-container">
        {scopedStyles ? (
          <style dangerouslySetInnerHTML={{ __html: scopedStyles }} />
        ) : null}
        <style dangerouslySetInnerHTML={{ __html: INVOICE_PREVIEW_SAFETY_STYLES }} />
        <div
          className={wrapClass}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </div>
  );
}
