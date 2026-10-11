import React from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import useButtonColor from "@/hooks/useButtonColor";

const CustomPagination = ({
  totalResults,
  resultsPerPage,
  currentPage,
  onChange,
}) => {
  const totalPages = Math.ceil(totalResults / resultsPerPage);
  const buttonColor = useButtonColor();
//   console.log("buttonColor", buttonColor);
//   console.log(
//     "totatl results",
//     totalResults,
//     "resultsPerPage",
//     resultsPerPage,
//     "totalPages",
//     totalPages
//   );
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if there are fewer than maxPagesToShow
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);

      // Calculate start and end of page range to show
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if we're near the beginning
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4);
      }

      // Adjust if we're near the end
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3);
      }

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pageNumbers.push("...");
      }

      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push("...");
      }

      // Always show last page
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    }

    return pageNumbers;
  };

  const handlePageClick = (page) => {
    if (page !== "..." && page !== currentPage) {
      onChange(page);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onChange(currentPage + 1);
    }
  };
  // Create active button style with the hex color
  const activeButtonStyle = {
    backgroundColor: buttonColor,
    color: "white", // Using black text for better contrast with light green
  };

  // Create focus outline style
  const focusStyle = {
    boxShadow: `0 0 0 3px ${buttonColor}33`, // Adding 33 for 20% opacity
  };

  return (
    <div className="flex items-center justify-end">
      <nav aria-label="Table navigation">
        <ul className="inline-flex items-center">
          <li>
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-md rounded-l-lg focus:outline-none focus:shadow-outline-purple ${
                currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""
              }`}
              aria-label="Previous"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
          </li>

          {getPageNumbers().map((page, i) => (
            <li key={i}>
              <button
                onClick={() => handlePageClick(page)}
                className={`px-3 py-1 rounded-md focus:outline-none ${
                  page === "..." ? "cursor-default" : ""
                }`}
                style={
                  page === currentPage
                    ? activeButtonStyle
                    : { ":focus": focusStyle }
                }
              >
                {page}
              </button>
            </li>
          ))}

          <li>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-md rounded-r-lg focus:outline-none focus:shadow-outline-purple ${
                currentPage === totalPages
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              aria-label="Next"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default CustomPagination;
