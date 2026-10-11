# Customer Statement System

## Overview
The Customer Statement System provides a professional way to generate, view, and download customer account statements. It integrates seamlessly with the existing customer invoice system and offers both PDF and CSV export options.

## Features

### 🎯 Core Functionality
- **Statement Generation**: Create professional customer statements with business and customer selection
- **Date Range Filtering**: Filter statements by specific date periods
- **Multiple Export Formats**: PDF (print-ready) and CSV (data analysis)
- **React Preview**: Interactive frontend preview with summary cards and business/customer details
- **PDF Preview**: Embedded PDF viewer for final document review
- **Statement History**: Track all generated statements

### 🎨 User Interface
- **Modern Design**: Clean, professional interface with intuitive navigation
- **Responsive Layout**: Works seamlessly on desktop and mobile devices
- **Real-time Updates**: Dynamic content updates based on user selections
- **Professional Styling**: Consistent with modern ERP system standards

### 📊 Statement Content
- **Business Information**: Company details, contact information, logo
- **Customer Details**: Name, company, billing address
- **Transaction Summary**: Opening balance, total invoiced, payments received, balance due
- **Detailed Transactions**: Chronological list of all invoices and payments
- **Professional Formatting**: Print-ready PDF with proper headers and footers

## Usage

### Accessing the System
1. Navigate to **Customer Invoices** page
2. Click the **"Customer Statement"** button (blue button)
3. Or directly navigate to `/customer-statement`

### Generating a Statement
1. **Select Business**: Choose the business entity
2. **Select Customer**: Choose the customer (populated based on business)
3. **Set Date Range**: Optional - filter by specific period
4. **Generate Preview**: Click "Generate Preview" to create statement
5. **Download**: Use "Download PDF" or "Export CSV" buttons

### Available Actions
- **Generate Preview**: Create and view statement
- **Download PDF**: Download professional PDF statement
- **Export CSV**: Export data for analysis
- **Print**: Print statement directly
- **Share**: Share statement URL
- **Regenerate**: Recreate statement with same parameters
- **Clear**: Reset form selections

## Technical Details

### Frontend Components
- **CustomerStatement.jsx**: Main statement generation page with React preview
- **CustomDatePicker**: Date selection component
- **React Preview**: Interactive summary cards showing financial overview
- **PDF Preview**: Embedded iframe for final document review
- **Integration**: Seamlessly integrated with existing invoice system

### Backend Integration
- **PDF Generation**: Uses PDFKit for professional statement creation
- **CSV Export**: Structured data export for analysis
- **API Endpoints**: 
  - `/proforma-invoice/customer-statement` (PDF)
  - `/proforma-invoice/customer-statement-csv` (CSV)

### Data Flow
1. User selects business, customer, and date range
2. Frontend sends request to backend
3. Backend queries invoice and payment data
4. PDF/CSV generated with professional formatting
5. File returned to frontend for preview/download

## File Structure

```
BaseSystem2.0-Frontend/
├── src/
│   ├── pages/Accounts/CustomerInvoice/
│   │   ├── CustomerStatement.jsx          # Main statement page
│   │   ├── CustomerInvoices.jsx           # Updated with statement link
│   │   └── ...
│   └── routes/
│       └── index.js                       # Added statement route

BaseSystem2.0-Backend/
├── ProformaInvoice/
│   ├── statementPDFGenerator.js           # PDF generation logic
│   ├── conroller.js                       # Statement API endpoints
│   └── routes.js                          # Statement routes
```

## Routes

### Frontend Routes
- `/customer-statement` - Main statement generation page

### Backend API Routes
- `POST /proforma-invoice/customer-statement` - Generate PDF statement
- `POST /proforma-invoice/customer-statement-csv` - Generate CSV statement

## Styling & Design

### Color Scheme
- **Primary**: Blue (#3B82F6) for main actions
- **Success**: Green (#10B981) for completed actions
- **Warning**: Yellow (#F59E0B) for pending items
- **Info**: Blue (#3B82F6) for informational elements

### Component Design
- **Cards**: Clean white cards with subtle shadows
- **Buttons**: Consistent button styling with hover effects
- **Forms**: Professional form inputs with focus states
- **Layout**: Responsive grid system for optimal viewing

## Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Support**: Responsive design for mobile devices
- **PDF Preview**: Uses iframe for PDF display
- **File Downloads**: Compatible with all modern browsers

## Future Enhancements
- **Email Integration**: Send statements directly to customers
- **Scheduled Generation**: Automatically generate statements
- **Template Customization**: Allow business-specific statement templates
- **Multi-language Support**: Internationalization for global businesses
- **Advanced Filtering**: More sophisticated date and data filtering options

## Troubleshooting

### Common Issues
1. **No Invoices Found**: Ensure customer has invoices in the selected business
2. **PDF Not Loading**: Check browser PDF viewer settings
3. **Download Fails**: Verify file permissions and browser download settings

### Performance Tips
- Use date ranges to limit data processing
- Clear statement history periodically for large datasets
- Ensure stable internet connection for large PDF generation

## Support
For technical support or feature requests, contact the development team or refer to the system documentation.
