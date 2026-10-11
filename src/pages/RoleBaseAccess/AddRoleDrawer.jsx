import React, { useState, useEffect } from "react";
import { Button, Input, Checkbox } from "@windmill/react-ui";
import { useTranslation } from "react-i18next";

const AddRoleDrawer = ({ existingRoles = [], onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [selectedModules, setSelectedModules] = useState({});
  const [roleName, setRoleName] = useState("");
  const [landingPage, setLandingPage] = useState("");

  console.log("add role drawer")
  
  // Form validation states
  const [errors, setErrors] = useState({
    roleName: "",
    landingPage: "",
    modules: ""
  });
  
  // Track if form was submitted to show validation immediately on subsequent changes
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Check if any modules are selected
  const hasSelectedModules = () => {
    return Object.keys(selectedModules).some(category => {
      const moduleValue = selectedModules[category];
      if (typeof moduleValue === 'boolean') return moduleValue;
      if (typeof moduleValue === 'object') {
        return Object.values(moduleValue).some(value => 
          typeof value === 'boolean' ? value : Object.values(value).some(v => v)
        );
      }
      return false;
    });
  };

  const modules = [
    {
      category: "Dashboard",
      actions: [],
    },
    {
      category: "Orders",
      actions: [],
    },
    {
      category: "Settings",
      subCategories: [
        {
          subCategory: "System Users",
          actions: ["AddData", "EditData", "DeleteData", "ChangeStatus", "RegeneratePassword"],
        },
        {
          subCategory: "Configuration",
          actions: [],
        },
        {
          subCategory: "User Roles",
          actions: ["AddRole", "EditRole", "DeleteRole"],
        },
      ],
    },
    {
      category: "Businesses",
      actions: ["AddData", "EditData", "DeleteData", "ViewData", "BulkDeleteData"],
    },
  ];

  // Generate landing page options based on available modules
  const getLandingPageOptions = () => {
    return modules.map(module => ({
      value: module.category,
      label: t(module.category)
    }));
  };

  const handleModuleSelect = (category) => {
    setSelectedModules((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
    
    // Re-validate modules if form was already submitted
    if (formSubmitted) {
      validateField('modules');
    }
  };

  const handleSubCategorySelect = (category, subCategory) => {
    setSelectedModules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [subCategory]: !prev[category]?.[subCategory],
      },
    }));
    
    // Re-validate modules if form was already submitted
    if (formSubmitted) {
      validateField('modules');
    }
  };

  const handleActionSelect = (category, subCategory, action) => {
    setSelectedModules((prev) => {
      if (subCategory) {
        return {
          ...prev,
          [category]: {
            ...prev[category],
            [subCategory]: {
              ...prev[category]?.[subCategory],
              [action]: !prev[category]?.[subCategory]?.[action],
            },
          },
        };
      } else {
        return {
          ...prev,
          [category]: {
            ...prev[category],
            [action]: !prev[category]?.[action],
          },
        };
      }
    });
    
    // Re-validate modules if form was already submitted
    if (formSubmitted) {
      validateField('modules');
    }
  };

  const handleRoleNameChange = (e) => {
    const value = e.target.value;
    setRoleName(value);
    
    // Re-validate role name if form was already submitted
    if (formSubmitted) {
      validateField('roleName', value);
    }
  };

  const handleLandingPageChange = (e) => {
    const value = e.target.value;
    setLandingPage(value);
    
    // Re-validate landing page if form was already submitted
    if (formSubmitted) {
      validateField('landingPage', value);
    }
  };

  // Validate individual field
  const validateField = (field, value) => {
    let errorMessage = "";
    
    switch(field) {
      case 'roleName':
        const nameToCheck = value !== undefined ? value : roleName;
        if (!nameToCheck.trim()) {
          errorMessage = t("Role name is required");
        } else if (nameToCheck.length < 3) {
          errorMessage = t("Role name must be at least 3 characters");
        } else if (existingRoles.some(role => role.name?.toLowerCase() === nameToCheck.toLowerCase())) {
          errorMessage = t("This role name already exists");
        }
        break;
      
      case 'landingPage':
        const pageToCheck = value !== undefined ? value : landingPage;
        if (!pageToCheck) {
          errorMessage = t("Landing page selection is required");
        }
        break;
      
      case 'modules':
        if (!hasSelectedModules()) {
          errorMessage = t("At least one permission must be selected");
        }
        break;
      
      default:
        break;
    }
    
    setErrors(prev => ({
      ...prev,
      [field]: errorMessage
    }));
    
    return !errorMessage;
  };

  // Validate the entire form
  const validateForm = () => {
    const roleNameValid = validateField('roleName');
    const landingPageValid = validateField('landingPage');
    const modulesValid = validateField('modules');
    
    return roleNameValid && landingPageValid && modulesValid;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSubmitted(true);
    
    if (validateForm()) {
      const roleData = {
        name: roleName,
        landingPage,
        permissions: selectedModules
      };
      
      onSubmit(roleData);
      onClose();
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
      <h2 className="text-lg font-semibold mb-4">{t("Add New Role")}</h2>
      <p className="mb-6">{t("Fill the form below to add a new Role.")}</p>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">{t("Role Name")} *</label>
          <Input
            type="text"
            placeholder={t("Enter role name!!")}
            value={roleName}
            onChange={handleRoleNameChange}
            className={errors.roleName ? "border-red-500" : ""}
            aria-invalid={!!errors.roleName}
            aria-describedby={errors.roleName ? "role-name-error" : undefined}
          />
          {errors.roleName && (
            <p id="role-name-error" className="mt-2 text-sm text-red-600 dark:text-red-500">
              {errors.roleName}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t("Select Landing")} *</label>
          <select
            className={`block w-full p-2 rounded-md border ${
              errors.landingPage ? "border-red-500" : "border-gray-300"
            } shadow-sm focus:ring-purple-500 focus:border-purple-500`}
            value={landingPage}
            onChange={handleLandingPageChange}
            aria-invalid={!!errors.landingPage}
            aria-describedby={errors.landingPage ? "landing-page-error" : undefined}
          >
            <option value="">{t("--Choose an option--")}</option>
            {getLandingPageOptions().map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.landingPage && (
            <p id="landing-page-error" className="mt-2 text-sm text-red-600 dark:text-red-500">
              {errors.landingPage}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-md font-medium mb-2">{t("Module Permissions")} *</h3>
        {errors.modules && (
          <p id="modules-error" className="mb-2 text-sm text-red-600 dark:text-red-500">
            {errors.modules}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <div 
              key={module.category} 
              className={`border p-4 rounded-lg ${errors.modules && !hasSelectedModules() ? "border-red-500" : "border-gray-300"}`}
            >
              <Checkbox
                id={module.category}
                checked={!!selectedModules[module.category]}
                onChange={() => handleModuleSelect(module.category)}
              >
                <span className="font-medium text-purple-600">{t(module.category)}</span>
              </Checkbox>
              {module.subCategories && (
                <div className="ml-4 mt-2">
                  {module.subCategories.map((subCategory) => (
                    <div key={subCategory.subCategory} className="mt-4">
                      <Checkbox
                        id={`${module.category}-${subCategory.subCategory}`}
                        checked={!!selectedModules[module.category]?.[subCategory.subCategory]}
                        onChange={() =>
                          handleSubCategorySelect(module.category, subCategory.subCategory)
                        }
                      >
                        <span className="font-medium text-blue-600">
                          {t(subCategory.subCategory)}
                        </span>
                      </Checkbox>
                      {subCategory.actions.length > 0 && (
                        <div className="ml-6 mt-2">
                          {subCategory.actions.map((action) => (
                            <div key={action} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${module.category}-${subCategory.subCategory}-${action}`}
                                checked={
                                  !!selectedModules[module.category]?.[subCategory.subCategory]?.[
                                    action
                                  ]
                                }
                                onChange={() =>
                                  handleActionSelect(
                                    module.category,
                                    subCategory.subCategory,
                                    action
                                  )
                                }
                              >
                                {t(action)}
                              </Checkbox>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {module.actions.length > 0 && !module.subCategories && (
                <div className="ml-4 mt-2">
                  {module.actions.map((action) => (
                    <div key={action} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${module.category}-${action}`}
                        checked={!!selectedModules[module.category]?.[action]}
                        onChange={() => handleActionSelect(module.category, null, action)}
                      >
                        {t(action)}
                      </Checkbox>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="button" className="mr-2" layout="outline" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button type="submit">{t("Add Role")}</Button>
      </div>
    </form>
  );
};

export default AddRoleDrawer;