import React from "react";
import { Editor } from "react-draft-wysiwyg";
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

const RichTextSection = ({ title, editorState, onEditorStateChange }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <h3 className="text-lg font-medium text-gray-900 px-6 py-4 border-b border-gray-100">
        {title}
      </h3>
      <div className="border-0">
        <Editor
          editorState={editorState}
          onEditorStateChange={onEditorStateChange}
          wrapperClassName="w-full"
          editorClassName="px-6 py-4 min-h-[200px]"
          toolbarClassName="border-0 border-b border-gray-100"
          toolbar={{
            options: [
              "inline",
              "blockType",
              "list",
              "textAlign",
              "link",
              "history",
            ],
            inline: {
              options: ["bold", "italic", "underline"],
            },
            className: "border-0 mx-6",
          }}
        />
      </div>
    </div>
  );
};

export default RichTextSection;
