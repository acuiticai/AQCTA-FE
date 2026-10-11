# Profitability Calculation Screen Implementation

## Overview
Created a comprehensive profitability calculation screen for sales contracts with aesthetic UI and user-friendly experience, following the existing design consistency and color scheme.

## Features Implemented

### 1. **Three-Step Flow**
- **Step 1**: Business Selection - Select a business to analyze
- **Step 2**: Sales Contract Selection - Choose specific sales contract
- **Step 3**: Profitability Analysis - Complete analysis with detailed breakdowns

### 2. **Business Selection Screen**
- Beautiful card-based layout for business selection
- Loading states with animated spinners
- Hover effects and smooth transitions
- Business information display (name, email)
- Consistent design with gradient icons

### 3. **Sales Contract Selection Screen**
- Grid layout showing all sales contracts for selected business
- Contract information cards with:
  - Contract number and customer company
  - Status badges (Processing, Completed, etc.)
  - Sales person, total value, product count, agent
  - Interactive hover effects
- "Change Business" option to go back
- Empty state handling

### 4. **Profitability Analysis Screen**
- **Header Section**: Contract details with breadcrumb navigation
- **Key Metrics Cards**:
  - Total Revenue (green)
  - Total Costs (red)
  - Gross Profit (blue/orange based on positive/negative)
  - Profit Margin percentage (purple/red)

- **Additional Metrics**:
  - Return on Investment (ROI)
  - Agent Commission
  - Contract Summary (invoices, vendor bills, expenses count)

- **Revenue & Cost Breakdown**:
  - Currency-wise revenue breakdown
  - Currency-wise cost breakdown (vendor invoices + expenses)
  - Color-coded cards (green for revenue, red for costs)

- **Contract Details Section**:
  - Basic information (contract number, status, creation date)
  - Customer details (company, final customer, reference)
  - Logistics (ETD port, loading/discharge ports)

- **Product Information Table**:
  - Product details from sales contract
  - Grade, quantity, price, total value, commission
  - Responsive table design

- **Detailed Tables**:
  - Customer Invoices table with status badges
  - Vendor Invoices table with payment status
  - Expenses table with vendor/employee information
  - All tables with responsive design and proper formatting

### 5. **Profitability Calculation Logic**
- **Currency Conversion**: Uses rough exchange rates for USD normalization
  - USD: 1, PKR: 0.0035, MYR: 0.236, EUR: 1.18, AED: 0.27
- **Revenue Calculation**: Sum of all customer invoices
- **Cost Calculation**: Sum of vendor invoices + expenses + agent commission
- **Metrics Calculation**:
  - Gross Profit = Revenue - Costs
  - Profit Margin = (Gross Profit / Revenue) × 100
  - ROI = (Gross Profit / Costs) × 100

### 6. **API Integration**
- **Businesses**: `GET /business`
- **Sales Contracts**: `GET /sales-contracts?businessId=X`
- **Customer Invoices**: `GET /proforma-invoice?contractId=X`
- **Vendor Invoices**: `GET /vendor-invoices?businessId=X`
- **Expenses**: `GET /expenses?businessId=X`

### 7. **Data Filtering**
- **Customer Invoices**: Filtered by `invoice.contract_id._id === selectedSalesContract._id`
- **Vendor Invoices**: Filtered by items having `contractId === selectedSalesContract._id`
- **Expenses**: Filtered by items having `contractType === "sales"` and `contractId === selectedSalesContract._id`

### 8. **UI/UX Features**
- **Loading States**: Spinner animations during data fetching
- **Error Handling**: Toast notifications for API errors
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Color Coding**: 
  - Green for positive metrics (revenue, profit)
  - Red for negative metrics (costs, losses)
  - Blue/Purple for neutral metrics
- **Status Badges**: Color-coded status indicators
- **Breadcrumb Navigation**: Shows current step and allows navigation
- **Interactive Elements**: Hover effects, smooth transitions

### 9. **Component Structure**
```
ProfitabilityCalculation.jsx (Main component)
├── Business Selection
├── Contract Selection  
└── ProfitabilityAnalysis.jsx (Separate component)
    ├── Header Section
    ├── Key Metrics
    ├── Additional Metrics
    ├── Breakdown Charts
    ├── Contract Details
    ├── Product Information
    └── DetailedTables.jsx (Sub-component)
        ├── Customer Invoices Table
        ├── Vendor Invoices Table
        └── Expenses Table
```

### 10. **Files Created**
- `BaseSystem2.0-Frontend/src/pages/Accounts/ProfitablityCalculation/ProfitabilityCalculation.jsx`
- `BaseSystem2.0-Frontend/src/pages/Accounts/ProfitablityCalculation/ProfitabilityAnalysis.jsx`
- `BaseSystem2.0-Frontend/PROFITABILITY_CALCULATION_IMPLEMENTATION.md`

## Technical Implementation Details

### State Management
- Uses React hooks (useState, useEffect, useContext)
- AdminContext for authentication and user information
- Step-based navigation state management

### API Calls
- Parallel API calls for efficiency using Promise.all()
- Proper error handling and loading states
- Authorization headers with Bearer tokens

### Currency Handling
- Multi-currency support with conversion to USD base
- Accurate formatting using formatAmount utility
- Currency-wise breakdowns for better analysis

### Performance Optimizations
- Separate components to avoid large bundle sizes
- Efficient data filtering and processing
- Minimal re-renders with proper state management

## Usage Instructions

1. **Navigate** to Profitability Calculation screen
2. **Select Business** from the list of available businesses
3. **Choose Sales Contract** to analyze
4. **View Analysis** with complete profitability breakdown
5. **Navigate Back** using breadcrumb or "Change" buttons

## Key Benefits

1. **Comprehensive Analysis**: Complete financial picture of sales contracts
2. **Multi-Currency Support**: Handles various currencies with conversion
3. **Beautiful UI**: Modern, responsive design with intuitive navigation
4. **Real-time Data**: Fetches live data from backend APIs
5. **Detailed Breakdown**: Shows all related invoices, vendor bills, and expenses
6. **Professional Presentation**: Suitable for business stakeholders and management

## Future Enhancements Possible

1. **Charts Integration**: Add pie charts and bar charts for visual representation
2. **Export Functionality**: PDF/Excel export of profitability reports
3. **Date Filtering**: Filter analysis by date ranges
4. **Comparison**: Compare multiple contracts side by side
5. **Forecasting**: Add projected profitability calculations
6. **Advanced Metrics**: Add more financial ratios and KPIs

This implementation provides a complete, professional-grade profitability analysis tool that helps businesses understand the financial performance of their sales contracts with detailed breakdowns and insights.
