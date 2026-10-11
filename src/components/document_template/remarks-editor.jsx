"use client"

import { useState } from "react"
import HtmlEditor from "./html-editor"

export default function RemarksEditor({ remarksHtml, onRemarksChange }) {
  const [expanded, setExpanded] = useState(true)

  const handleRemarksChange = (content) => {
    onRemarksChange(content)
  }

  const defaultRemarksHtml = `
    <ol>
      <li>ETD POL: DECEMBER 2024 - SUBJECT TO LC RECEIVE AND VESSEL SPACE AVAILABILITY</li>
      <li>KINDLY ENSURE FIRST RECEIVING BANK WILL BE EITHER ONE OF THE BELOW UPON OPEN OF LC:
        <br>- ALLIANCE BANK MALAYSIA BERHAD (MFBBMYKL)
        <br>- STANDARD CHARTERED MALAYSIA (SCBLMYKXXXX)
        <br>- CITIBANK MALAYSIA (CITIMYKL)</li>
      <li>THE LATEST SHIPMENT DATE SHOULD AT LEAST 45 DAYS FROM LC ISSUANCE DATE</li>
    </ol>
  `

  return (
    <div className="space-y-6">
      <HtmlEditor
        content={remarksHtml || defaultRemarksHtml}
        onContentChange={handleRemarksChange}
        label="Remarks"
        placeholder="Enter remarks here..."
      />
    </div>
  )
}

