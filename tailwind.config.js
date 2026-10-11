const defaultTheme = require("tailwindcss/defaultTheme");

const config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Outfit",
          "Segoe UI",
          ...defaultTheme.fontFamily.sans,
        ],
        display: ["Outfit", "Plus Jakarta Sans", ...defaultTheme.fontFamily.sans],
        serif: ["Outfit", ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        bottom:
          "0 5px 6px -7px rgba(0, 0, 0, 0.6), 0 2px 4px -5px rgba(0, 0, 0, 0.06)",
      },
      fontSize: {
        sm: "12px",
        base: "14px",
        md: "16px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      colors: {
        // Primary Colors
        "p-white": "var(--p-white)",
        "p-blue": "var(--p-blue)",
        "p-blue-light": "var(--p-blue-light)",
        "p-blue-light-2": "var(--p-blue-light-2)",
        "p-blue-dark": "var(--p-blue-dark)",
        "p-gray": "var(--p-gray)",
        "p-gray-light": "var(--p-gray-light)",
        "p-gray-dark": "var(--p-gray-dark)",
        "p-gray-dark2": "var(--p-gray-dark2)",
        "p-black": "var(--p-black)",
        "p-black2": "var(--p-black2)",
        "placeholder-text": "var(--placeholder-text)",
        "input-background-gray": "var(--input-background-gray)",
        "p-red": "var(--p-red)",
        // Status Colors
        overdue: "var(--overdue)",
        pending: "var(--pending)",
        processing: "var(--processing)",
        paid: "var(--paid)",
        rejected: "var(--rejected)",

        "summary-light": "var(--summary-light)",
        "overdue-light": "var(--overdue-light)",
        "pending-light": "var(--pending-light)",
        "processing-light": "var(--processing-light)",
        "completed-light": "var(--completed-light)",
        "planning-light": "var(--planning-light)",
        "pre-shipment-light": "var(--pre-shipment-light)",
        "in-transit-origin-light": "var(--in-transit-origin-light)",
        "in-transit-destination-light": "var(--in-transit-destination-light)",
        "post-shipment-light": "var(--post-shipment-light)",

        "summary-dark": "var(--summary-dark)",
        "overdue-dark": "var(--overdue-dark)",
        "pending-dark": "var(--pending-dark)",
        "processing-dark": "var(--processing-dark)",
        "completed-dark": "var(--completed-dark)",

        "planning-dark": "var(--planning-dark)",
        "pre-shipment-dark": "var(--pre-shipment-dark)",
        "in-transit-origin-dark": "var(--in-transit-origin-dark)",
        "in-transit-destination-dark": "var(--in-transit-destination-dark)",
        "post-shipment-dark": "var(--post-shipment-dark)",

        // Text Colors
        "light-text": "var(--light-text)",
        white: "var(--white)",
      },
      height: {
        28: "100px",
        sm: "350px",
        md: "400px",
        330: "330px",
        440: "440px",
        lg: "500px",
        xl: "600px",
      },
      width: {
        80: "80px",
        100: "100px",
        200: "200px",
        300: "300px",
        400: "400px",
      },
      padding: {
        2.5: "10px",
        6: "24px",
      },
      screens: {
        "2xl": "1440px",
        xl: "1280px",
        lg: "1024px",
        ipad: { min: "960px", max: "1023px" },
        md: "768px",
        sm: "640px",
        xs: "420px",
        xss: "320px",
      },
      inset: {
        "-1": "-1rem",
        "-2": "-2rem",
        "-3": "-3rem",
        "-4": "-4rem",
        "-5": "-5rem",
        "-6": "-6rem",
        "-7": "-7rem",
        "-8": "-8rem",
        "-9": "-9rem",
        "-10": "-10rem",
        1: "1rem",
        2: "2rem",
        3: "3rem",
        4: "4rem",
        5: "5rem",
        6: "6rem",
        7: "7rem",
        8: "8rem",
        9: "9rem",
        10: "10rem",
      },
    },
  },
  variants: {
    display: ["group-hover"],
  },
  plugins: [
    require("tailwind-scrollbar-hide"),
    //require('tailwind-scrollbar')
  ],
};

module.exports = {
  ...config,
};
