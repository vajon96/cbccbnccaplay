import { useEffect } from "react";

interface DocumentMetaOptions {
  title: string;
  description?: string;
}

const DEFAULT_DESCRIPTION =
  "Official digital portal of Cox's Bazar City College BNCC Platoon (Army Wing, 15 BNCC Battalion, Karnaphuli Regiment, E Company).";

export function useDocumentMeta({ title, description }: DocumentMetaOptions) {
  useEffect(() => {
    const fullTitle = title.includes("BNCC")
      ? title
      : `${title} | Cox's Bazar City College BNCC Platoon`;
    document.title = fullTitle;

    const descText = description || DEFAULT_DESCRIPTION;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", descText);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", fullTitle);
    }
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute("content", descText);
    }
  }, [title, description]);
}
