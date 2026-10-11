"use client"

import { Plus, Trash2 } from "lucide-react"

export default function TableManager({ items, onItemsChange }) {
  const addRow = () => {
    const newItem = {
      name: "New Item",
      description: "Item description",
      quantity: 1,
      rate: 0,
      amount: 0,
    }

    onItemsChange([...items, newItem])
  }

  const removeRow = (index) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    onItemsChange(newItems)
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // Auto-calculate amount if quantity or rate changes
    if (field === "quantity" || field === "rate") {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate
    }

    onItemsChange(newItems)
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-2 text-left">Item</th>
              <th className="border border-gray-200 px-4 py-2 text-left">Description</th>
              <th className="border border-gray-200 px-4 py-2 text-center">Qty</th>
              <th className="border border-gray-200 px-4 py-2 text-right">Rate</th>
              <th className="border border-gray-200 px-4 py-2 text-right">Amount</th>
              <th className="border border-gray-200 px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="border border-gray-200 px-4 py-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="w-full p-1 border border-gray-300 rounded-md"
                  />
                </td>
                <td className="border border-gray-200 px-4 py-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    className="w-full p-1 border border-gray-300 rounded-md"
                  />
                </td>
                <td className="border border-gray-200 px-4 py-2">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                    className="w-full p-1 border border-gray-300 rounded-md text-center"
                  />
                </td>
                <td className="border border-gray-200 px-4 py-2">
                  <input
                    type="number"
                    value={item.rate}
                    onChange={(e) => updateItem(index, "rate", Number(e.target.value))}
                    className="w-full p-1 border border-gray-300 rounded-md text-right"
                  />
                </td>
                <td className="border border-gray-200 px-4 py-2">
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => updateItem(index, "amount", Number(e.target.value))}
                    className="w-full p-1 border border-gray-300 rounded-md text-right"
                    readOnly
                  />
                </td>
                <td className="border border-gray-200 px-4 py-2">
                  <button onClick={() => removeRow(index)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} className="flex items-center text-lime-500 hover:text-lime-700">
        <Plus className="w-4 h-4 mr-1" /> Add Row
      </button>
    </div>
  )
}

