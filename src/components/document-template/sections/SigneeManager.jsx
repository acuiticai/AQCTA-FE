import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import { useDocumentConext } from "@/pages/DocumentTemplate/DocumentContext";

const SigneeManager = () => {
  const { signees, setSignees, setRequireSignee, setFooterText, FooterText, setFooterText2, FooterText2, } = useDocumentConext();

  const addSignee = () => {
    setSignees([
      ...signees,
      { id: Date.now(), title: "", name: "", designation: "" },
    ]);
  };

  return (
    <div className="space-y-3 p-4 bg-white rounded-lg shadow-sm border border-gray-200 text-sm">
      <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-base font-medium text-gray-900">
            Document Signees
          </h3>
          <p className="text-xs text-gray-500">Add signature fields</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRequireSignee(true);
            addSignee();
          }}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-lime-500 hover:bg-lime-600 transition-colors duration-200"
        >
          <AddIcon className="h-3 w-3 mr-1" />
          Add Signee
        </button>
      </div>


      <div className="space-y-2">
        {signees.map((signee, index) => (
          <div
            key={signee.id}
            className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-md"
          >
            <input
              type="text"
              value={signee.title}
              onChange={(e) => {
                const newSignees = [...signees];
                newSignees[index].title = e.target.value;
                setSignees(newSignees);
              }}
              placeholder="Title"
              className="flex-1 min-w-[120px] rounded-md border p-1.5 text-xs border-gray-300 focus:border-lime-400"
            />
            <input
              type="text"
              value={signee.name}
              onChange={(e) => {
                const newSignees = [...signees];
                newSignees[index].name = e.target.value;
                setSignees(newSignees);
              }}
              placeholder="Name"
              className="flex-1 min-w-[120px] rounded-md border p-1.5 text-xs border-gray-300 focus:border-lime-500"
            />
            <button
              type="button"
              onClick={() =>
                setSignees(signees.filter((s) => s.id !== signee.id))
              }
              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
            >
              <DeleteIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-base font-medium text-gray-900">
            Footer Text 1
          </h3>
          <p className="text-xs text-gray-500">Add Footer Text 1</p>
        </div>
      </div>
      <div className="space-y-2">
        <div
          key={'1'}
          className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-md"
        >
          <input
            type="text"
            defaultValue={FooterText2}
            onChange={(e) => { setFooterText2(e.target.value); }}
            placeholder="Add Document Footer"
            className="flex-1 min-w-[220px] rounded-md border p-1.5 text-xs border-gray-300 focus:border-lime-400"
          />
        </div>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-base font-medium text-gray-900">
            Footer Text 2
          </h3>
          <p className="text-xs text-gray-500">Add Footer Text 2</p>
        </div>
      </div>

      <div className="space-y-2">
        <div
          key={'1'}
          className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 rounded-md"
        >
          <input
            type="text"
            defaultValue={FooterText}
            onChange={(e) => { setFooterText(e.target.value); }}
            placeholder="Add Document Footer"
            className="flex-1 min-w-[220px] rounded-md border p-1.5 text-xs border-gray-300 focus:border-lime-400"
          />
        </div>
      </div>

    </div>
  );
};

export default SigneeManager;
