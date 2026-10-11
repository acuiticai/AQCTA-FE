import * as Icons from "react-icons/fi"; // Import all icons from `react-icons/fi`

// Function to dynamically fetch an icon by name
export const getIcon = (iconName) => {
  return Icons[iconName] || Icons["FiGrid"]; // Fallback to FiGrid if the icon doesn't exist
};
