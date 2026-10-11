"use client"

import { useState } from "react"
import HtmlEditor from "./html-editor"

export default function TermsEditor({ termsHtml, onTermsChange }) {
  const [expanded, setExpanded] = useState(true)

  const handleTermsChange = (content) => {
    onTermsChange(content)
  }

  const defaultTermsHtml = `
    <ol>
      <li>SUBJECT TO THE TERMS & CONDITIONS OF THE INTERNATIONAL CONTRACTS FOR TECHNICALLY SPECIFIED RUBBER</li>
      <li>ALL BANK CHARGES OUTSIDE OF BENEFICIARY'S BANK ARE FOR ACCOUNT OF BUYER (APPLICANT)</li>
      <li>DRAFT LETTER OF CREDIT (LC) MUST BE SENT TO BARENA FOR AGREEMENT BEFORE LC ISSUANCE, OTHERWISE BARENA HAS THE RIGHT TO REQUEST FOR AMENDMENT WITHOUT ACCEPTING ANY AMENDMENT COST</li>
      <li>A TOLERANCE NOT EXCEED 5% MORE OR 5% LESS THAN THE QUANTITY AND AMOUNT OF THE GOODS IS ALLOWED</li>
      <li>ACCEPTANCE OF BILL MUST BE WITHIN 3 WORKING DAYS UPON RECEIVE BY APPLICANT'S BANK</li>
      <li>IN THE LC, TO MENTION SUBMISSION OF FOLLOWING SHIPPING DOCUMENTS ONLY:
        <br>(1)COMMERCIAL INVOICE, (2)PACKING LIST AND (3) BILL OF LADING.ANDACCEPTANCE OF THIRD PARTY DOCUMENTS TO BE MENTION IN LC.
        <br>OTHER RELEVANT DOCUMENTS IF IS REQUIRED WILL BE SENT VIA EMAIL.</li>
      <li>PHYTOSANITARY AND HEAT TREATMENT FEES IF ANY TO BE AT BUYER ACCOUNT</li>
    </ol>
  `

  return (
    <div className="space-y-6">
      <HtmlEditor
        content={termsHtml || defaultTermsHtml}
        onContentChange={handleTermsChange}
        label="Terms & Conditions"
        placeholder="Enter terms and conditions here..."
      />
    </div>
  )
}

