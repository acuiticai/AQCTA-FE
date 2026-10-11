import requests from "./httpService";
import axios from "axios";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

// Financial Dashboard API Service
class FinancialService {
  constructor() {
    this.baseURL = Base_URL;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    console.log("FinancialService baseURL:", this.baseURL); // Debug log
  }

  // Utility method to format date range for API calls
  formatDateRange(dateRange) {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      return null;
    }
    return `${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`;
  }

  // Utility method to validate date range
  validateDateRange(dateRange) {
    if (!dateRange) return true;
    const { from, to } = dateRange;
    if (!from || !to) return false;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return false;
    if (fromDate > toDate) return false;
    return true;
  }

  async getTransactionStats(
    dateRange = null,
    business = null,
    currency = "USD"
  ) {
    try {
      const params = new URLSearchParams();

      if (dateRange) {
        params.append("dateRange", this.formatDateRange(dateRange));
      }

      if (business) {
        params.append("business", business);
      }

      if (currency) {
        params.append("currency", currency);
      }

      // Use the existing httpService pattern
      const data = await requests.get(`/ledger/stats?${params}`);

      return {
        totalBalance: Number(data.totalBalance) || 0,
        totalIncome: Number(data.totalIncome) || 0,
        totalExpense: Number(data.totalExpense) || 0,
        currency: data.currency || currency,
        transactionCounts: data.transactionCounts || {},
      };
    } catch (error) {
      console.error("Error fetching transaction stats:", error);
      throw new Error(`Failed to fetch transaction stats: ${error.message}`);
    }
  }

  async getTransactions(filters = {}) {
    try {
      // Build query parameters for transactions with better validation
      const params = new URLSearchParams();

      // Handle pagination
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      params.append("page", page);
      params.append("limit", limit);

      // Handle filters
      if (filters.business) {
        params.append("business", filters.business);
      }

      if (filters.dateRange) {
        params.append("dateRange", filters.dateRange);
      }

      if (filters.name) {
        params.append("name", filters.name);
      }

      if (filters.transactionType && filters.transactionType !== "All") {
        params.append("transactionType", filters.transactionType);
      }

      if (filters.category && filters.category !== "All") {
        params.append("category", filters.category);
      }

      if (filters.account) {
        params.append("account", filters.account);
      }

      const data = await requests.get(`/ledger/transactions?${params}`);

      return {
        transactions: data.transactions || [],
        total: data.total || 0,
        stats: data.stats || {
          totalBalance: 0,
          totalIncome: 0,
          totalExpense: 0,
        },
      };
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
  }

  async getTransactionsByDateRange(startDate, endDate, business = null) {
    try {
      const body = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      if (business) {
        body.business = business;
      }

      const data = await requests.post("/ledger/test", body);

      return {
        transactions: data.transactions || [],
        stats: data.stats || {
          totalBalance: 0,
          totalIncome: 0,
          totalExpense: 0,
        },
      };
    } catch (error) {
      console.error("Error fetching transactions by date range:", error);
      throw new Error(
        `Failed to fetch transactions by date range: ${error.message}`
      );
    }
  }

  async getBankAccounts(filters = {}) {
    try {
      // Build query parameters
      const params = new URLSearchParams();

      const limit = filters.limit || 50;
      params.append("limit", limit);

      if (filters.business) {
        params.append("business", filters.business);
      }

      // Use bank management endpoint
      const data = await requests.get(`/bank-managements?${params}`);

      return {
        accounts: data.accounts || data || [],
        total: data.total || (data || []).length,
      };
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      throw new Error(`Failed to fetch bank accounts: ${error.message}`);
    }
  }

  async getAnalyticsData(
    period = "Week",
    dateRange = null,
    business = null,
    currency = "USD"
  ) {
    try {
      const cacheKey = `analytics-${period}-${JSON.stringify(
        dateRange
      )}-${business}-${currency}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const params = new URLSearchParams();
      params.append("period", period);

      if (dateRange) {
        params.append("dateRange", this.formatDateRange(dateRange));
      }

      if (business) {
        params.append("business", business);
      }

      if (currency) {
        params.append("currency", currency);
      }

      const result = await requests.get(`/ledger/analytics?${params}`);

      // Transform the data for frontend consumption
      const transformedData = result.data.map((item) => ({
        name: item.name,
        totalProfit: Number(item.totalProfit) || 0,
        income: Number(item.income) || 0,
        expenses: Number(item.expenses) || 0,
        losses: Number(item.losses) || 0,
      }));

      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now(),
      });

      return transformedData;
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      throw new Error(`Failed to fetch analytics data: ${error.message}`);
    }
  }

  async getActivityData(
    period = "Month",
    dateRange = null,
    business = null,
    currency = "USD"
  ) {
    try {
      const cacheKey = `activity-${period}-${JSON.stringify(
        dateRange
      )}-${business}-${currency}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      const params = new URLSearchParams();
      params.append("period", period);

      if (dateRange) {
        params.append("dateRange", this.formatDateRange(dateRange));
      }

      if (business) {
        params.append("business", business);
      }

      if (currency) {
        params.append("currency", currency);
      }

      const result = await requests.get(`/ledger/activity?${params}`);

      // Transform the data for frontend consumption
      const transformedData = result.data.map((item) => ({
        name: item.name,
        value: Number(item.value) || 0,
        transactionCount: Number(item.transactionCount) || 0,
      }));

      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedData,
        timestamp: Date.now(),
      });

      return transformedData;
    } catch (error) {
      console.error("Error fetching activity data:", error);
      throw new Error(`Failed to fetch activity data: ${error.message}`);
    }
  }

  // Get available currencies for a business (using same endpoint as vendor invoices)
  async getCurrencies(business = null) {
    try {
      const cacheKey = `currencies-${business}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Use the same endpoint as vendor invoices
      const params = business ? `?business_id=${business}` : "";
      const data = await requests.get(`/finance/currencies${params}`);

      // Transform to match the expected format
      const currencies = (data.data || []).map((currency) => ({
        code: currency.symbol,
        name: `${currency.symbol} (${currency.prefix})`,
        symbol: currency.symbol === "USD" ? "$" : currency.symbol,
        conversionRate: currency.conversion_rate_to_base,
      }));

      // Always include USD as fallback
      const usdExists = currencies.some((c) => c.code === "USD");
      if (!usdExists) {
        currencies.unshift({
          code: "USD",
          name: "USD ($)",
          symbol: "$",
          conversionRate: 1,
        });
      }

      // Cache the result
      this.cache.set(cacheKey, {
        data: currencies,
        timestamp: Date.now(),
      });

      return currencies;
    } catch (error) {
      console.error("Error fetching currencies:", error);
      // Return USD as fallback
      return [
        {
          code: "USD",
          name: "USD ($)",
          symbol: "$",
          conversionRate: 1,
        },
      ];
    }
  }

  // Convert currency using the same API as vendor invoices
  async convertCurrency(fromCurrency, toCurrency, amount, businessId = null) {
    try {
      if (fromCurrency === toCurrency) {
        return {
          success: true,
          convertedAmount: amount,
          rate: 1,
          displayText: `${amount} ${fromCurrency} = ${amount} ${toCurrency}`,
        };
      }

      const params = new URLSearchParams({
        from: fromCurrency,
        to: toCurrency,
        amount: amount,
      });

      if (businessId) {
        params.append("businessId", businessId);
      }

      const data = await requests.get(`/currency/convert?${params}`);

      return {
        success: true,
        convertedAmount: data.convertedAmount,
        rate: data.rate,
        displayText:
          data.displayText ||
          `${amount} ${fromCurrency} = ${data.convertedAmount} ${toCurrency}`,
      };
    } catch (error) {
      console.error("Error converting currency:", error);
      return {
        success: false,
        error: error.message,
        convertedAmount: amount,
        rate: 1,
      };
    }
  }

  // Get data points for different time periods
  getStartDateByPeriod(period, endDate) {
    const end = new Date(endDate);
    const start = new Date(end);

    switch (period) {
      case "Day":
        start.setDate(start.getDate() - 7); // Last 7 days
        break;
      case "Week":
        start.setDate(start.getDate() - 4 * 7); // Last 4 weeks
        break;
      case "Month":
        start.setMonth(start.getMonth() - 6); // Last 6 months
        break;
      case "Year":
        start.setFullYear(start.getFullYear() - 3); // Last 3 years
        break;
      default:
        start.setDate(start.getDate() - 30); // Default 30 days
    }

    return start;
  }

  // Generate data points for time periods
  getDataPointsByPeriod(period, startDate, endDate) {
    const dataPoints = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    let current = new Date(start);
    let index = 0;

    while (current <= end && index < 50) {
      // Prevent infinite loops
      const pointStart = new Date(current);
      let pointEnd = new Date(current);
      let name = "";

      switch (period) {
        case "Day":
          pointEnd.setHours(23, 59, 59, 999);
          name = pointStart.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          current.setDate(current.getDate() + 1);
          break;
        case "Week":
          pointEnd.setDate(pointEnd.getDate() + 6);
          pointEnd.setHours(23, 59, 59, 999);
          name = `W${index + 1}`;
          current.setDate(current.getDate() + 7);
          break;
        case "Month":
          pointEnd.setMonth(pointEnd.getMonth() + 1);
          pointEnd.setDate(0); // Last day of month
          pointEnd.setHours(23, 59, 59, 999);
          name = pointStart.toLocaleDateString("en-US", { month: "short" });
          current.setMonth(current.getMonth() + 1);
          break;
        case "Year":
          pointEnd.setFullYear(pointEnd.getFullYear() + 1);
          pointEnd.setMonth(0, 0); // Last day of year
          pointEnd.setHours(23, 59, 59, 999);
          name = pointStart.getFullYear().toString();
          current.setFullYear(current.getFullYear() + 1);
          break;
      }

      if (pointStart > end) break;

      dataPoints.push({
        name,
        start: pointStart,
        end: pointEnd > end ? end : pointEnd,
      });

      index++;
    }

    return dataPoints;
  }

  // Export functions
  exportToCSV(data, filename) {
    try {
      if (!data || data.length === 0) {
        throw new Error("No data to export");
      }

      // Convert data to CSV format
      const csvContent = this.convertToCSV(data);

      // Create and download file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");

      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error exporting CSV:", error);
      throw new Error(`Failed to export CSV: ${error.message}`);
    }
  }

  async exportToPDF(reportData, filename) {
    try {
      console.log("Generating PDF export...", reportData);

      // Generate HTML content for PDF
      const htmlContent = this.generateReportHTML(reportData);

      try {
        // Get authentication token from localStorage or cookies
        const token =
          localStorage.getItem("adminToken") ||
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("adminToken="))
            ?.split("=")[1];

        // Use the HTML to PDF service with axios directly for better blob handling
        const response = await axios.post(
          `${Base_URL}/html-to-pdf/`,
          {
            html: htmlContent,
            options: {
              format: "A4",
              printBackground: true,
              margin: {
                top: "20px",
                bottom: "20px",
                left: "20px",
                right: "20px",
              },
            },
          },
          {
            responseType: "blob",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/pdf",
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            timeout: 30000, // 30 second timeout
          }
        );

        // Validate that we received a proper blob
        if (!response.data || response.data.size === 0) {
          throw new Error("Received empty PDF data from server");
        }

        // Create download link with proper blob handling
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        console.log("PDF exported successfully, size:", blob.size, "bytes");
      } catch (pdfError) {
        console.error("PDF service failed:", pdfError);

        // Check if it's a server error or network issue
        if (pdfError.response?.status === 404) {
          throw new Error("PDF service not available on server");
        } else if (pdfError.response?.status === 401) {
          throw new Error("Authentication required for PDF export");
        } else if (pdfError.code === "ECONNABORTED") {
          throw new Error("PDF generation timeout");
        } else {
          throw new Error(`PDF generation failed: ${pdfError.message}`);
        }
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);

      // Show user-friendly error and provide fallback
      alert(
        `PDF export failed: ${
          error.message || "Unknown error"
        }. Downloading as text file instead.`
      );

      // Fallback: Export as formatted text file
      console.log("PDF export failed, using text fallback");
      this.exportAsFormattedText(reportData, filename.replace(".pdf", ".txt"));
    }
  }

  // Generate HTML content for PDF report
  generateReportHTML(reportData) {
    const { summary, transactions, business, currency, generatedAt } =
      reportData;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Financial Report</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid var(--p-blue);
            padding-bottom: 20px;
          }
          .company-name { 
            font-size: 24px; 
            font-weight: bold; 
            color: var(--p-blue); 
            margin-bottom: 10px;
          }
          .report-title { 
            font-size: 18px; 
            color: #666; 
          }
          .summary { 
            margin-bottom: 30px; 
            background: #f9f9f9; 
            padding: 20px; 
            border-radius: 8px;
          }
          .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 20px; 
          }
          .metric { 
            text-align: center; 
          }
          .metric-label { 
            font-size: 12px; 
            color: #666; 
            text-transform: uppercase; 
            margin-bottom: 5px;
          }
          .metric-value { 
            font-size: 20px; 
            font-weight: bold; 
          }
          .positive { color: #22c55e; }
          .negative { color: #ef4444; }
          .neutral { color: #6b7280; }
          .transactions { 
            margin-top: 30px; 
          }
          .section-title { 
            font-size: 16px; 
            font-weight: bold; 
            margin-bottom: 15px; 
            color: #374151;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px;
          }
          th, td { 
            border: 1px solid #e5e7eb; 
            padding: 8px; 
            text-align: left; 
            font-size: 12px;
          }
          th { 
            background-color: #f3f4f6; 
            font-weight: bold;
          }
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            font-size: 10px; 
            color: #9ca3af;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Financial Dashboard</div>
          <div class="report-title">Financial Report</div>
        </div>
        
        <div class="info-row">
          <span><strong>Business:</strong> ${business}</span>
          <span><strong>Currency:</strong> ${currency}</span>
        </div>
        <div class="info-row">
          <span><strong>Generated:</strong> ${new Date(
            generatedAt
          ).toLocaleString()}</span>
          <span><strong>Report Type:</strong> Financial Summary</span>
        </div>
        
        <div class="summary">
          <div class="section-title">Financial Summary (${currency})</div>
          <div class="summary-grid">
            <div class="metric">
              <div class="metric-label">Total Balance</div>
              <div class="metric-value ${
                summary.totalBalance >= 0 ? "positive" : "negative"
              }">
                ${
                  summary.totalBalance >= 0 ? "+" : ""
                }${summary.totalBalance.toLocaleString()}
              </div>
            </div>
            <div class="metric">
              <div class="metric-label">Total Income</div>
              <div class="metric-value positive">+${summary.totalIncome.toLocaleString()}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Total Expenses</div>
              <div class="metric-value negative">-${summary.totalExpense.toLocaleString()}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Net Result</div>
              <div class="metric-value ${
                summary.totalBalance >= 0 ? "positive" : "negative"
              }">
                ${summary.totalBalance >= 0 ? "Profit" : "Loss"}
              </div>
            </div>
          </div>
        </div>
        
        <div class="transactions">
          <div class="section-title">Transaction Details (Last ${Math.min(
            transactions.length,
            50
          )} transactions)</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount (${currency})</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${transactions
                .slice(0, 50)
                .map(
                  (t) => `
                <tr>
                  <td>${new Date(t.date).toLocaleDateString()}</td>
                  <td>${t.reference || "N/A"}</td>
                  <td>${t.type}</td>
                  <td>${(t.description || "").substring(0, 40)}${
                    (t.description || "").length > 40 ? "..." : ""
                  }</td>
                  <td class="${
                    t.type === "Income" || t.type === "Debit Note"
                      ? "positive"
                      : "negative"
                  }">
                    ${
                      t.type === "Income" || t.type === "Debit Note" ? "+" : "-"
                    }${Math.abs(t.amount).toLocaleString()}
                  </td>
                  <td>${t.status || "N/A"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          ${
            transactions.length > 50
              ? `<p style="margin-top: 10px; font-style: italic; color: #666;">Showing first 50 of ${transactions.length} transactions</p>`
              : ""
          }
        </div>
        
        <div class="footer">
          <div>Report generated on ${new Date().toLocaleString()}</div>
          <div>Financial Dashboard - Transaction Analysis</div>
        </div>
      </body>
      </html>
    `;
  }

  // Fallback export as formatted text
  exportAsFormattedText(reportData, filename) {
    const { summary, transactions, business, currency, generatedAt } =
      reportData;

    let content = `FINANCIAL REPORT\n`;
    content += `=================\n\n`;
    content += `Business: ${business}\n`;
    content += `Currency: ${currency}\n`;
    content += `Generated: ${new Date(generatedAt).toLocaleString()}\n\n`;

    content += `FINANCIAL SUMMARY (${currency})\n`;
    content += `---------------------------\n`;
    content += `Total Balance: ${
      summary.totalBalance >= 0 ? "+" : ""
    }${summary.totalBalance.toLocaleString()}\n`;
    content += `Total Income:  +${summary.totalIncome.toLocaleString()}\n`;
    content += `Total Expenses: -${summary.totalExpense.toLocaleString()}\n`;
    content += `Net Result: ${
      summary.totalBalance >= 0 ? "Profit" : "Loss"
    }\n\n`;

    content += `RECENT TRANSACTIONS\n`;
    content += `-------------------\n`;
    content += `Date\t\tRef\t\tType\t\tAmount\t\tStatus\n`;
    content += `----\t\t---\t\t----\t\t------\t\t------\n`;

    transactions.slice(0, 20).forEach((t) => {
      const date = new Date(t.date).toLocaleDateString().padEnd(12);
      const ref = (t.reference || "N/A").substring(0, 10).padEnd(12);
      const type = t.type.padEnd(12);
      const amount = `${
        t.type === "Income" || t.type === "Debit Note" ? "+" : "-"
      }${Math.abs(t.amount).toLocaleString()}`.padEnd(12);
      const status = (t.status || "N/A").padEnd(10);
      content += `${date}\t${ref}\t${type}\t${amount}\t${status}\n`;
    });

    // Create and download file
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Convert data to CSV format
  convertToCSV(data) {
    if (!data || data.length === 0) {
      return "";
    }

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(",");

    const csvRows = data.map((row) => {
      return headers
        .map((header) => {
          let cell = row[header];

          // Handle null/undefined values
          if (cell === null || cell === undefined) {
            cell = "";
          }

          // Escape quotes and wrap in quotes if necessary
          if (typeof cell === "string") {
            cell = cell.replace(/"/g, '""');
            if (
              cell.includes(",") ||
              cell.includes('"') ||
              cell.includes("\n")
            ) {
              cell = `"${cell}"`;
            }
          }

          return cell;
        })
        .join(",");
    });

    return [csvHeaders, ...csvRows].join("\n");
  }

  async getFinancialReport(dateRange, business = null, currency = "USD") {
    try {
      const stats = await this.getTransactionStats(
        dateRange,
        business,
        currency
      );
      const transactions = await this.getTransactions({
        dateRange: this.formatDateRange(dateRange),
        business,
        limit: 1000,
      });

      return {
        summary: {
          totalBalance: stats.totalBalance,
          totalIncome: stats.totalIncome,
          totalExpense: stats.totalExpense,
          currency: currency,
        },
        transactions: transactions.transactions || [],
        business: business || "All",
        currency: currency,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error generating financial report:", error);
      throw new Error(`Failed to generate financial report: ${error.message}`);
    }
  }

  // Clear cache (useful when business changes)
  clearCache() {
    this.cache.clear();
    console.log("Financial service cache cleared");
  }

  // Clear specific cache entries
  clearCacheForBusiness(business) {
    const keysToDelete = [];
    for (const [key] of this.cache.entries()) {
      if (
        key.includes(`-${business}`) ||
        key.includes(`currencies-${business}`)
      ) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
    console.log(`Cleared cache for business: ${business}`);
  }
}

export default new FinancialService();
