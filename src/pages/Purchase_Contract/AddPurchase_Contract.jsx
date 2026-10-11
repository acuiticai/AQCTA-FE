import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Tab, Tabs, TabList, TabPanel } from "react-tabs"
import "react-tabs/style/react-tabs.css"
import BasicInfo from "./components/BasicInfo_Sales.jsx"
import ProductInfo from "./components/ProductInfo_Sales.jsx"
import { usePurchaseContext } from "./context/PurchaseContractContext"
import { FiArrowLeft, FiFileText, FiInfo, FiPackage } from "react-icons/fi";
import { useHistory } from "react-router-dom"

const SalesContractScreen = () => {
  const [selectedTab, setSelectedTab] = useState(0)
  const { selectedBusiness, setSelectedBusiness, setContractId, businesses, setCommissionPerMTS, contractId } = usePurchaseContext()
  const location = useLocation()
  const history = useHistory()

  // Get the sales contract data and creation flag from location state
  const salesContractData = location.state?.salesContractData
  const creatingForSales = location.state?.creating_For_Sales

  // Set commissionPerMTS in context if present in salesContractData
  useEffect(() => {
    if (salesContractData?.commissionPerMTS) {
      setCommissionPerMTS(salesContractData.commissionPerMTS);
    }
  }, [salesContractData, setCommissionPerMTS]);

  console.log("props location", location)
  const clearState = location.state?.clearState

  useEffect(() => {
    if (clearState) {
      window.location.reload()
      setSelectedBusiness(null)
      setContractId(null)
      setSelectedTab(0)
      if (location?.state) {
        history.push({ pathname: "/add-sales-contract", state: { clearState: false } })
      }
      console.log("SalesContractScreen: State cleared and reloaded.")
    }
  }, [clearState])

  return (
    <div className="py-6 px-6 min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white font-sans purchase-contract-add"  >
      <div className="w-full mx-auto my-1">
        {/* Single, left-aligned Back Button above the card */}
        <button
          className="flex items-center gap-2 text-gray-700 mb-6 px-5 py-2 rounded-full bg-white shadow hover:bg-green-50 hover:text-green-700 transition font-semibold text-lg border border-gray-200"
          onClick={() => history.push('/purchase_contracts')}
        >
          <FiArrowLeft className="text-2xl" /> <span>Back</span>
        </button>
        <div className="bg-white/95 rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100">
          {/* New Contract Header with icon and subtitle */}
          <div className="flex items-center gap-3 mb-2">
            <FiFileText className="text-green-500 text-3xl" />
            <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
              {creatingForSales ? "New Purchase Contract (From Sales)" : "New Contract"}
            </h1>
          </div>
          <div className="text-gray-500 text-base mb-6 ml-1">Fill in the details below to create a new contract.</div>
          <div className="border-b border-gray-200 mb-8"></div>
          <Tabs selectedIndex={selectedTab} onSelect={(index) => setSelectedTab(index)}>
            <TabList className="flex mb-8 gap-4">
              <Tab
                className="flex items-center gap-2 px-6 py-2 cursor-pointer rounded-full text-gray-500 text-base font-semibold transition-all duration-200 hover:text-green-600 hover:bg-green-50 border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-green-300"
                selectedClassName="bg-green-500 text-white shadow-lg border-green-500 scale-105 z-10"
              >
                <FiInfo className="text-lg" /> Basic Info
              </Tab>
              <Tab
                className="flex items-center gap-2 px-6 py-2 cursor-pointer rounded-full text-gray-500 text-base font-semibold transition-all duration-200 hover:text-green-600 hover:bg-green-50 border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-green-300"
                selectedClassName="bg-green-500 text-white shadow-lg border-green-500 scale-105 z-10"
              >
                <FiPackage className="text-lg" /> Product/Item Info
              </Tab>
            </TabList>
            <div className="border-b border-gray-100 mb-8"></div>
            <TabPanel>
              <div className="animate-fade-in">
                <BasicInfo
                  businesses={businesses}
                  selectedBusiness={selectedBusiness}
                  setSelectedBusiness={setSelectedBusiness}
                  onSave={(selectedContractId) => {
                    setContractId(selectedContractId)
                    setSelectedTab(1)
                  }}
                />
              </div>
            </TabPanel>
            <TabPanel>
              <div className="animate-fade-in">
                <ProductInfo selectedBusiness={selectedBusiness} />
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </div>
      {/* Scoped style: make disabled/readonly field text visible (light green) */}
      <style jsx>{`
        .purchase-contract-add input:disabled,
        .purchase-contract-add select:disabled,
        .purchase-contract-add textarea:disabled {
          color: #98B13D !important;
          -webkit-text-fill-color: #98B13D;
          opacity: 1;
        }
        .purchase-contract-add input[readonly],
        .purchase-contract-add textarea[readonly] {
          color: #98B13D !important;
          -webkit-text-fill-color: #98B13D;
          opacity: 1;
        }
        /* Supplier Contract Date field should be black - target input with supplier-contract-date-field class */
        .purchase-contract-add input.supplier-contract-date-field,
        .purchase-contract-add input.supplier-contract-date-field:disabled,
        .purchase-contract-add input.supplier-contract-date-field[readonly],
        .purchase-contract-add .react-datepicker__input-container input.supplier-contract-date-field,
        .purchase-contract-add .react-datepicker__input-container input.supplier-contract-date-field:disabled,
        .purchase-contract-add .react-datepicker__input-container input.supplier-contract-date-field[readonly] {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}

export default SalesContractScreen

/* Add this to your global CSS (e.g., index.css or tailwind.css):
.animate-fade-in {
  animation: fadeIn 0.6s cubic-bezier(0.4,0,0.2,1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(32px); }
  to { opacity: 1; transform: none; }
}
*/
