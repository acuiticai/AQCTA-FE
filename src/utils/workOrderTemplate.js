export const WORK_ORDER_TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Work Order</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #333;
            margin: 0;
            padding: 20px;
            background: #fff;
        }
        .container {
            max-width: 800px;
            margin: auto;
            border: 1px solid #ccc;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        .logo-section {
            width: 50%;
            margin-top: 30px;
        }
        .logo-section img {
            max-width: 250px;
            height: auto;
        }
        .title-section {
            text-align: left;
            width: 45%;
        }
        .title-section h1 {
            font-size: 24px;
            margin: 0;
            color: #000;
        }
        .sst-no {
            font-size: 12px;
            margin-top: 5px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            border: 1px solid #000;
            margin-bottom: 20px;
        }
        .info-box {
            border: 0.5px solid #000;
            padding: 5px;
        }
        .info-label {
            font-weight: bold;
            font-size: 9px;
            color: #666;
            margin-bottom: 2px;
            text-transform: uppercase;
        }
        .info-value {
            font-size: 12px;
            font-weight: bold;
        }
        .address-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            border: 1px solid #000;
            margin-bottom: 10px;
        }
        .address-box {
            border: 0.5px solid #000;
            padding: 10px;
            min-height: 120px;
        }
        .address-header {
            background: #f0f0f0;
            padding: 5px;
            font-weight: bold;
            border-bottom: 1px solid #000;
            margin: -10px -10px 10px -10px;
        }
        .table-section {
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #000;
        }
        th {
            background: #f0f0f0;
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
        }
        td {
            border: 1px solid #000;
            padding: 8px;
            vertical-align: top;
            min-height: 25px;
        }
        .qty-col { width: 60px; text-align: center; }
        .desc-col { }
        
        .disclaimer-section {
            font-size: 9px;
            margin-bottom: 20px;
        }
        .disclaimer-section h3 {
            font-size: 10px;
            margin-bottom: 5px;
        }
        .disclaimer-section ol {
            padding-left: 15px;
            margin: 0;
        }
        .disclaimer-section li {
            margin-bottom: 3px;
        }

        .footer-section {
            display: grid;
            grid-template-columns: 2fr 1fr 2fr;
            gap: 20px;
            margin-top: 20px;
        }
        .payable-info {
            font-size: 10px;
        }
        .payable-info b { font-size: 12px; }
        .qr-section { text-align: center; }
        .qr-section img { width: 100px; }
        .notes-section {
            border: 1px solid #000;
            padding: 5px;
            min-height: 60px;
        }
        .signature-section {
            text-align: right;
            margin-top: 10px;
        }
        .sig-line {
            border-top: 1px solid #000;
            display: inline-block;
            width: 200px;
            text-align: center;
            padding-top: 5px;
        }
        .company-footer {
            text-align: center;
            margin-top: 10px;
            font-size: 9px;
            border-top: 1px solid #eee;
            padding-top: 10px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-section">
            <% if (contract.businessLogo) { %>
                <img src="<%= contract.businessLogo %>" alt="Logo">
            <% } else { %>
                <h2 style="color: #0066cc;">ChemDry</h2>
            <% } %>
        </div>
        <div class="title-section">
            <h1>WORK ORDER</h1>
            <div class="sst-no">SST No: <%= contract.businessSstNo || 'B16-1902-32000206' %></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #000; margin-top: 10px; text-align: left;">
                <div class="info-box">
                    <div class="info-label">Work Order #</div>
                    <div class="info-value"><%= contract.invoice_number %></div>
                </div>
                <div class="info-box">
                    <div class="info-label">Date</div>
                    <div class="info-value"><%= contract.date %></div>
                </div>
                <div class="info-box">
                    <div class="info-label">Sales Rep. #</div>
                    <div class="info-value"><%= contract.salesPerson || 'Lilian Leong' %></div>
                </div>
                <div class="info-box">
                    <div class="info-label">Time</div>
                    <div class="info-value"><%= contract.orderTime || '12:00 PM' %></div>
                </div>
            </div>
        </div>
    </div>

    <div class="address-section">
        <div class="address-box">
            <div class="address-header">Customer Info</div>
            <div class="info-label">Account Name & Address:</div>
            <div class="info-value"><%= contract.buyerName %></div>
            <div style="margin-top: 10px; white-space: pre-wrap;"><%= contract.buyerAddress %></div>
            <div style="margin-top: 10px;">Tel: <%= contract.buyerPhone %></div>
            <div style="margin-top: 5px;">P.O. # / Vendor #: <%= contract.po_no %></div>
        </div>
        <div class="address-box">
            <div class="address-header">Service Location</div>
            <div class="info-label">Job Site Name & Address:</div>
            <div class="info-value"><%= contract.shipToName || 'Primary Address' %></div>
            <div style="margin-top: 10px; white-space: pre-wrap;"><%= contract.shipToAddress || contract.buyerAddress %></div>
            <div style="margin-top: 10px;">Tel: <%= contract.shipToPhone || contract.buyerPhone %></div>
            <div style="margin-top: 5px;">Payment Terms: <%= contract.paymentTerms %></div>
        </div>
    </div>

    <div style="border: 1px solid #000; padding: 5px; margin-bottom: 10px;">
        <span class="info-label">Job Technician:</span>
        <span class="info-value" style="margin-left: 10px;"><%= contract.technicianName || '' %></span>
    </div>

    <div class="table-section">
        <table>
            <thead>
                <tr>
                    <th class="qty-col">Qty.</th>
                    <th class="desc-col">Description</th>
                </tr>
            </thead>
            <tbody>
                <% contract.items.forEach((item, index) => { %>
                <tr>
                    <td class="qty-col"><%= item.quantity %></td>
                    <td class="desc-col">
                        <b><%= item.name %></b>
                        <% if (item.description) { %>
                            <div style="font-size: 10px; color: #444; margin-top: 3px; white-space: pre-wrap;"><%= item.description %></div>
                        <% } %>
                    </td>
                </tr>
                <% }); %>
                <% /* Fill empty rows to match look */ %>
                <% for(let i = contract.items.length; i < 10; i++) { %>
                <tr>
                    <td class="qty-col" style="height: 25px;">&nbsp;</td>
                    <td class="desc-col">&nbsp;</td>
                </tr>
                <% } %>
            </tbody>
        </table>
    </div>

    <% if (contract.waiverTitle || (contract.waiverItems && contract.waiverItems.length) || contract.waiverBody) { %>
    <div class="disclaimer-section">
        <% if (contract.waiverTitle) { %><h3><%= contract.waiverTitle %></h3><% } %>
        <% if (contract.waiverItems && contract.waiverItems.length) { %>
        <ol>
            <% contract.waiverItems.forEach((item) => { %>
            <li><%= item %></li>
            <% }); %>
        </ol>
        <% } else if (contract.waiverBody) { %>
        <div style="white-space: pre-wrap;"><%= contract.waiverBody %></div>
        <% } %>
    </div>
    <% } %>

    <div class="footer-section">
        <div class="payable-info">
            *E.&.O.E.<br><br>
            <b>Payable to:</b><br>
            Chem-Dry (Malaysia) Sdn. Bhd.<br>
            Reg. No: 198801000204 (167560-T)<br>
            <b>Maybank Islamic Berhad</b><br>
            <b>A/C No.: <span style="text-decoration: underline;">5641 3753 4608</span></b>
        </div>
        <div class="qr-section">
             <img src="<%= contract.qrCodeUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=Chem-Dry%20Malaysia%20Sdn%20Bhd' %>" alt="QR Code">
             <div style="font-size: 8px; font-weight: bold; margin-top: 5px;">Chem-Dry Malaysia Sdn Bhd</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="notes-section">
                <div class="info-label">Notes:</div>
                <div style="font-size: 10px;"><%= contract.notes %></div>
            </div>
            <div style="font-size: 10px; text-align: right;">Thank you for choosing<br>Chem-Dry.</div>
            <div class="signature-section">
                <div class="sig-line">Customer Signature / Date</div>
            </div>
        </div>
    </div>

    <div class="company-footer">
        <b>CHEM-DRY (MALAYSIA) SDN. BHD.</b><br>
        336 Jalan Midah Besar, Taman Midah, 56000 Kuala Lumpur.<br>
        +603 9171 3122 | +6012 6622 934 | www.chemdry.com.my | lilian@chemdry.com.my
    </div>
</body>
</html>
`;
