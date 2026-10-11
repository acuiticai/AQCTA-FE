import { useEffect, useMemo, useState } from "react";
import {
  getCachedEmailTemplateForBusiness,
  primeEmailTemplateCache,
  resolveEmailTemplateForBusiness,
} from "@/services/documentTemplateService";
import { resolveEmailTemplateHtmlContent } from "@/utils/standardEmailTemplate";

/**
 * Resolves the standard email template shell with instant cached/default render
 * and a background refresh from the API.
 */
export function useStandardEmailTemplate(businessId, headers = {}, initialDoc = null) {
  const [emailTemplateDoc, setEmailTemplateDoc] = useState(() => {
    if (initialDoc?.htmlContent) {
      primeEmailTemplateCache(businessId, initialDoc);
      return initialDoc;
    }
    return getCachedEmailTemplateForBusiness(businessId);
  });

  useEffect(() => {
    if (initialDoc?.htmlContent) {
      primeEmailTemplateCache(businessId, initialDoc);
      setEmailTemplateDoc(initialDoc);
    }
  }, [businessId, initialDoc]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const tpl = await resolveEmailTemplateForBusiness(businessId, headers);
        if (!cancelled && tpl?.htmlContent) {
          setEmailTemplateDoc(tpl);
        }
      } catch (error) {
        console.error("Failed to load email template:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const htmlContent = useMemo(
    () => resolveEmailTemplateHtmlContent(emailTemplateDoc),
    [emailTemplateDoc],
  );

  return {
    emailTemplateDoc,
    htmlContent,
    dummyData: emailTemplateDoc?.dummyData || {},
  };
}

export default useStandardEmailTemplate;
