import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { CustomAreaChart } from "./custom-area-chart";
import { CustomPieChart } from "./custom-pie-chart";
import { AlertCircle, RefreshCw } from "lucide-react";

const MergedAnalyticsCharts = ({
  analyticsData = [],
  pieData = [],
  analyticsPeriod = "Week",
  setAnalyticsPeriod,
  isLoading = false,
  error = null,
  onRetry = null,
  currency = "USD",
}) => {
  // Use default data if no real data is provided (fallback)
  const defaultAnalyticsData = [
    {
      name: "W1",
      totalProfit: 14500,
      income: 17500,
      expenses: 4500,
      losses: 2500,
    },
    {
      name: "W2",
      totalProfit: 15500,
      income: 19000,
      expenses: 5000,
      losses: 2500,
    },
    {
      name: "W3",
      totalProfit: 13500,
      income: 16500,
      expenses: 4500,
      losses: 2500,
    },
    {
      name: "W4",
      totalProfit: 14800,
      income: 18000,
      expenses: 5000,
      losses: 2500,
    },
  ];

  const defaultPieData = [
    { name: "Total Profit", value: 60, color: "var(--p-blue)" },
    { name: "Income", value: 75, color: "#A855F7" },
    { name: "Expenses", value: 15, color: "#374151" },
    { name: "Losses", value: 8, color: "#EC4899" },
  ];

  const currentAnalyticsData =
    analyticsData.length > 0
      ? analyticsData
      : error
      ? []
      : defaultAnalyticsData;
  const currentPieData =
    pieData.length > 0 ? pieData : error ? [] : defaultPieData;

  const handlePeriodChange = (period) => {
    if (setAnalyticsPeriod && period !== analyticsPeriod) {
      setAnalyticsPeriod(period);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <Card className="bg-[#F9F9FA] shadow-sm border-gray-100">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-md font-semibold text-gray-900">
                Analytics
              </CardTitle>
              {isLoading && (
                <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
              )}
              {error && (
                <div className="flex items-center gap-1" title={error}>
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-500">Error</span>
                </div>
              )}
            </div>
            <div className="flex gap-1 w-full sm:w-auto">
              {["Day", "Week", "Month", "Year"].map((period) => (
                <Button
                  key={period}
                  variant={analyticsPeriod === period ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePeriodChange(period)}
                  disabled={isLoading}
                  className={
                    analyticsPeriod === period
                      ? "bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white flex-1 sm:flex-none"
                      : "text-gray-600 hover:bg-gray-100 flex-1 sm:flex-none"
                  }
                  aria-label={`Change analytics period to ${period}`}
                >
                  {period}
                </Button>
              ))}
            </div>
          </div>

          {/* Unified Legend - Only show if not in error state */}
          {!error && (
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[var(--p-blue)] rounded-full"></div>
                <span className="text-gray-600">Total Profit</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                <span className="text-gray-600">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-800 rounded-full"></div>
                <span className="text-gray-600">Expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-pink-500 rounded-full"></div>
                <span className="text-gray-600">Losses</span>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Error State */}
          {error ? (
            <div className="h-64 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
              <div className="text-center max-w-md p-4">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <div className="text-red-700 text-sm font-medium mb-2">
                  Failed to load analytics data
                </div>
                <div className="text-red-600 text-xs mb-4 max-w-xs mx-auto">
                  {error}
                </div>
                {onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    disabled={isLoading}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      "Retry"
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* Charts Container */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
              {/* Area Chart */}
              <div className="lg:col-span-2 pr-0 lg:pr-6">
                {isLoading ? (
                  <div className="h-64 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
                    <div className="text-gray-500 text-sm">
                      Loading analytics...
                    </div>
                  </div>
                ) : (
                  <CustomAreaChart data={currentAnalyticsData} />
                )}
              </div>

              {/* Vertical Separator */}
              <div className="hidden lg:block w-px bg-gray-200 absolute"></div>

              {/* Horizontal Separator for mobile */}
              <div className="lg:hidden w-full h-px bg-gray-200 my-4"></div>

              {/* Donut Chart */}
              <div className="flex flex-col items-center justify-center pl-0 lg:pl-6 relative">
                {/* Vertical line for desktop */}
                <div className="hidden lg:block absolute left-0 top-0 w-px bg-gray-200 h-full"></div>

                {isLoading ? (
                  <div className="w-40 h-40 bg-gray-100 animate-pulse rounded-full flex items-center justify-center">
                    <div className="text-gray-500 text-sm">Loading...</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <CustomPieChart data={currentPieData} currency={currency} />
                    {/* Data summary below pie chart */}
                    {currentPieData.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        {currentPieData.map((item, index) => (
                          <div key={index} className="flex items-center gap-1">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            <span className="text-gray-600 truncate">
                              {item.name}:{" "}
                              {currency === "USD" ? "$" : currency + " "}
                              {item.value?.toLocaleString() || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export { MergedAnalyticsCharts };
