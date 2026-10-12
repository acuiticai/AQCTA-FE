import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { useState } from "react";
import Loader from "./Loader";

// Pass both selectedIndex and onSelectedIndexChange for parent-controlled tabs (e.g. programmatic tab switches).
const CustomTabs = ({ tabs, onTabChange, selectedIndex: controlledIndex = 0, onSelectedIndexChange }) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const isControlled = typeof onSelectedIndexChange === "function";
  const selectedIndex = isControlled ? controlledIndex : internalIndex;

  const onSelect = (index) => {
    if (isControlled) {
      onSelectedIndexChange(index);
    } else {
      setInternalIndex(index);
    }
    onTabChange?.(tabs[index]?.label);
  };

  return (
    <Tabs selectedIndex={selectedIndex} onSelect={onSelect} className="mt-8">
      <TabList className="flex mb-10">
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            className="px-4 py-2 mx-2 cursor-pointer border-b-[3px]"
            selectedClassName="border-b-[3px] border-[var(--p-blue)] font-bold"
          >
            {tab.label}
          </Tab>
        ))}
      </TabList>

      {tabs.map((tab, index) =>
        tab.loading ? (
          <TabPanel className="mt-8" key={index}>
            <div className="flex justify-center items-center h-full">
              <Loader />
            </div>
          </TabPanel>
        ) : (
          <TabPanel className="mt-8" key={index}>
            {tab.content}
          </TabPanel>
        )
      )}
    </Tabs>
  );
};

export { CustomTabs };
