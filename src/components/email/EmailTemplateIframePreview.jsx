import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

const PREVIEW_EMAIL_WIDTH_CSS = `<style type="text/css" data-email-preview-full-width="true">
  html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; }
  .email-container,
  table.email-container {
    max-width: 640px !important;
    width: 100% !important;
    margin: 0 auto !important;
  }
  .email-outer > tbody > tr > td,
  .email-outer td[align="center"] {
    padding: 0 !important;
  }
</style>`;

export function stripPreviewFullWidthStyles(html) {
  return String(html || "").replace(
    /<style[^>]*data-email-preview-full-width="true"[^>]*>[\s\S]*?<\/style>/gi,
    "",
  );
}

function withPreviewFullWidth(html, fullWidth) {
  const content = stripPreviewFullWidthStyles(html);
  if (!fullWidth || !content) return content;
  if (content.includes("</head>")) {
    return content.replace("</head>", `${PREVIEW_EMAIL_WIDTH_CSS}</head>`);
  }
  return `${PREVIEW_EMAIL_WIDTH_CSS}${content}`;
}

/**
 * Isolated email preview — same approach as Document Templates page (iframe),
 * so global app CSS does not override inline email table/layout styles.
 */
const EmailTemplateIframePreview = forwardRef(function EmailTemplateIframePreview(
  {
    html,
    editable = false,
    onChange,
    className = "",
    minHeight = "600px",
    title = "Email preview",
    fullWidth = true,
  },
  ref,
) {
  const iframeRef = useRef(null);
  const [frameHeight, setFrameHeight] = useState(0);

  const syncFrameHeight = () => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!doc?.body) return;
    const height = Math.max(
      doc.body.scrollHeight,
      doc.documentElement?.scrollHeight || 0,
      doc.body.offsetHeight,
      doc.documentElement?.offsetHeight || 0,
    );
    if (height > 0) setFrameHeight(height);
  };

  const syncFrameHeightAfterAssets = () => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!doc?.body) return;
    const imgs = doc.querySelectorAll("img");
    if (!imgs.length) {
      syncFrameHeight();
      return;
    }
    let pending = imgs.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) syncFrameHeight();
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
  };

  useImperativeHandle(ref, () => ({
    getDocument: () =>
      iframeRef.current?.contentDocument ||
      iframeRef.current?.contentWindow?.document ||
      null,
    getHtml: () => {
      const doc = iframeRef.current?.contentDocument;
      return stripPreviewFullWidthStyles(doc?.documentElement?.outerHTML || "");
    },
  }));
  const resolvedHtml = useMemo(
    () => withPreviewFullWidth(html, fullWidth),
    [html, fullWidth],
  );

  useEffect(() => {
    if (editable) return;
    requestAnimationFrame(syncFrameHeightAfterAssets);
    const t1 = setTimeout(syncFrameHeightAfterAssets, 50);
    const t2 = setTimeout(syncFrameHeightAfterAssets, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [resolvedHtml, editable]);

  useEffect(() => {
    if (!editable) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(resolvedHtml);
    doc.close();

    if (doc.body) {
      doc.body.contentEditable = "true";
      doc.body.style.outline = "none";
      doc.body.style.margin = "0";
      doc.body.style.overflow = "visible";
    }
    requestAnimationFrame(syncFrameHeightAfterAssets);
  }, [resolvedHtml, editable]);

  useEffect(() => {
    if (!editable) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;

    const resize = () => requestAnimationFrame(syncFrameHeightAfterAssets);
    const observer = new ResizeObserver(resize);
    observer.observe(doc.body);
    resize();

    return () => observer.disconnect();
  }, [resolvedHtml, editable]);

  useEffect(() => {
    if (!editable || !onChange) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;

    const handleInput = () => {
      onChange(stripPreviewFullWidthStyles(doc.documentElement.outerHTML));
    };

    doc.body.addEventListener("input", handleInput);
    return () => doc.body.removeEventListener("input", handleInput);
  }, [editable, onChange, resolvedHtml]);

  const frameClassName = `w-full max-w-none border-0 block ${className}`.trim();
  const resolvedHeight = frameHeight > 0 ? frameHeight : minHeight;
  const frameStyle = {
    height: typeof resolvedHeight === "number" ? `${resolvedHeight}px` : resolvedHeight,
    minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
    width: "100%",
    maxWidth: "100%",
    background: "#f4f6f8",
    display: "block",
    overflow: "hidden",
  };

  const handleLoad = () => {
    requestAnimationFrame(syncFrameHeightAfterAssets);
    setTimeout(syncFrameHeightAfterAssets, 50);
    setTimeout(syncFrameHeightAfterAssets, 300);
  };

  if (!editable) {
    return (
      <iframe
        ref={iframeRef}
        srcDoc={resolvedHtml}
        title={title}
        className={frameClassName}
        style={frameStyle}
        sandbox="allow-same-origin allow-popups"
        scrolling="no"
        onLoad={handleLoad}
      />
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={title}
      className={frameClassName}
      style={frameStyle}
      sandbox="allow-same-origin allow-popups"
      scrolling="no"
    />
  );
});

export default EmailTemplateIframePreview;
