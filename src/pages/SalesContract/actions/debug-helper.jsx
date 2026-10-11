const DataDebugger = ({ data, title = "Debug Data" }) => {
    if (!data) return <div className="p-4 bg-red-100 text-red-800">No data provided</div>
  
    return (
      <div className="p-4 bg-blue-100 text-blue-800 text-xs">
        <h4 className="font-bold">{title}</h4>
        <pre className="mt-2 overflow-auto max-h-40">{JSON.stringify(data, null, 2)}</pre>
      </div>
    )
  }
  
  export default DataDebugger
  