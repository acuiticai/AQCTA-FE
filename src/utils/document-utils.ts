/**
 * Utility functions for document template handling
 * Provides consistent handling of business logos and seller names across components
 */

// Get the image URL from environment variable or configuration
const IMAGE_URL = process.env.NEXT_PUBLIC_API_SOCKET_URL || "";

/**
 * Prepares contract data with business information for template rendering
 * @param contractData The contract data object
 * @param businessDetails The business details object
 * @returns Updated contract data with business information
 */
export function prepareContractDataWithBusinessInfo(
  contractData: any,
  businessDetails: any
) {
  if (!contractData || !businessDetails) return contractData;

  // Create a deep copy to avoid mutating the original data
  const updatedData = JSON.parse(JSON.stringify(contractData));

  // Get business logo and name
  const businessLogo = businessDetails?.image ? `${businessDetails.image}` : "";
  const businessName = businessDetails?.name || "BARENA GROUP SDN BHD";

  // Update contract data with business information
  if (updatedData.beneficiary) {
    updatedData.beneficiary.accountHolder = businessName;
  }

  updatedData.sellerName = businessName;
  updatedData.businessLogo = businessLogo;

  return updatedData;
}

/**
 * Renders a template with contract data
 * @param templateContent The HTML template content
 * @param contractData The contract data to inject into the template
 * @param signatureFileURL Optional signature file URL
 * @returns Rendered HTML content
 */
export function renderTemplateWithContractData(
  templateContent: string,
  contractData: any,
  signatureFileURL?: string
) {
  if (!templateContent) {
    return "<!DOCTYPE html><html><head><title>Contract</title></head><body><h1>Error</h1><p>Template content is missing</p></body></html>";
  }

  if (!contractData) {
    return "<!DOCTYPE html><html><head><title>Contract</title></head><body><h1>Error</h1><p>Contract data is missing</p></body></html>";
  }

  // Process template with contract data
  let processedTemplate = templateContent;

  // Replace logo URL in the template
  if (contractData.businessLogo) {
    processedTemplate = processedTemplate.replace(
      /<img src="[^"]*" alt="PCI Group Logo">/g,
      `<img src="${contractData.businessLogo}" alt="${contractData.sellerName} Logo">`
    );

    // Also add a direct logo URL replacement to ensure it works
    processedTemplate = processedTemplate.replace(
      /src="[^"]*logo[^"]*"/gi,
      `src="${contractData.businessLogo}"`
    );
  }

  // Replace <%= variable %> patterns
  processedTemplate = processedTemplate.replace(
    /<%= ?([\w.]+) ?%>/g,
    (match, variable) => {
      // Handle nested properties like "contract.ref"
      const props = variable.split(".");
      let value = contractData;

      for (const prop of props) {
        value = value?.[prop];
        if (value === undefined) return "[" + variable + "]";
      }

      return value;
    }
  );

  // Handle EJS forEach loops for terms with HTML content
  processedTemplate = processedTemplate.replace(
    /<% contract\.terms\.forEach\$\$function\$\$term, index\$\$ { %>([\s\S]*?)<% }\$\$; %>/g,
    (match, loopContent) => {
      return contractData.terms
        ? contractData.terms
            .map((term: any) => {
              // Allow HTML content in terms to be rendered properly
              return loopContent.replace(/<%= term %>/g, term);
            })
            .join("")
        : "";
    }
  );

  // Add signature to the template if available
  if (signatureFileURL) {
    processedTemplate = processedTemplate.replace(
      /<div class="signature-placeholder"><\/div>/g,
      `<img src="${signatureFileURL}"  alt="Signature" style="max-height: 80px;" />`
    );
  }

  return processedTemplate;
}

/**
 * Formats the item name for invoice tables based on productInfo.
 * Replace this logic with Ihtesham's function if provided.
 * @param {object} productInfo - The product info object from contract
 * @returns {string} - Formatted item name
 */
export function formatInvoiceItemName(productInfo: any): string {
  if (!productInfo) return "";
  // Example: "Carbon Black (1.26MTS Shrinkwrapped Per Pallet)"
  let name = productInfo.title || "";
  if (productInfo.packing) {
    name += ` (${productInfo.packing})`;
  }
  // Add more formatting as needed
  return name;
}
