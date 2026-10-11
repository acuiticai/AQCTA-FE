import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { customerInvoiceText as ciText } from "@/utils/customerInvoiceI18n";
import { X, AlertTriangle, MessageCircle } from "lucide-react";
import axios from "axios";
import { notifyError, notifySuccess } from "@/utils/toast";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const CommentModal = ({ isOpen, onClose, invoiceId }) => {
  useTranslation();
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminInfo, setAdminInfo] = useState();
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    commentId: null,
  });

  useEffect(() => {
    if (isOpen && invoiceId) {
      fetchComments();
    }
  }, [isOpen, invoiceId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${Base_URL}/proforma-invoice/${invoiceId}/comments`,
      );
      setComments(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setLoading(false);
      notifyError(ciText("Failed to load comments"));
    }
    const storedAdminInfo = localStorage.getItem("adminInfo");
    if (storedAdminInfo) {
      setAdminInfo(JSON.parse(storedAdminInfo));
    }
  };

  const handleAddComment = async () => {
    if (commentInput.trim() === "") return;

    try {
      setSubmitting(true);

      const response = await axios.post(
        `${Base_URL}/proforma-invoice/${invoiceId}/comments`,
        {
          author: adminInfo?.name,
          authorId: adminInfo?.id,
          text: commentInput,
        },
      );

      setComments([...comments, response.data]);
      setCommentInput("");
      notifySuccess(ciText("Comment added successfully"));

      setSubmitting(false);
    } catch (err) {
      console.error("Error adding comment:", err);
      setSubmitting(false);
      notifyError(ciText("Failed to add comment"));
    }
  };

  const openDeleteModal = (commentId) => {
    setDeleteModal({
      isOpen: true,
      commentId,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      commentId: null,
    });
  };

  const handleDeleteComment = async () => {
    try {
      await axios.delete(
        `${Base_URL}/proforma-invoice/${invoiceId}/comments/${deleteModal.commentId}`,
      );

      setComments(
        comments.filter((comment) => comment._id !== deleteModal.commentId),
      );
      notifySuccess(ciText("Comment deleted successfully"));
      closeDeleteModal();
    } catch (err) {
      console.error("Error deleting comment:", err);
      notifyError(ciText("Failed to delete comment"));
      closeDeleteModal();
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {ciText("Comments & History")}
          </h2>
          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            onClick={onClose}
            aria-label={ciText("Close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ciText("Add a comment")}
            </label>
            <div className="relative">
              <textarea
                className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-white text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)] focus:border-transparent transition-all"
                rows={3}
                placeholder={ciText("Type your comment here...")}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex justify-end mt-3">
              <button
                className={`px-5 py-2.5 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#9CBA33] transition-all font-medium shadow-sm flex items-center gap-2 ${
                  submitting
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:shadow-md"
                }`}
                onClick={handleAddComment}
                disabled={submitting || commentInput.trim() === ""}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{ciText("Adding...")}</span>
                  </>
                ) : (
                  ciText("Add Comment")
                )}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                {ciText("All Comments")}
                <span className="bg-[var(--p-blue)] text-white rounded-full px-2.5 py-1 text-xs font-semibold">
                  {comments.length}
                </span>
              </h3>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-[var(--p-blue)] rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-500 text-sm mt-4">
                  {ciText("Loading comments...")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div
                    key={comment._id}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all relative group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900">
                            {comment.author}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <button
                        className="flex-shrink-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all duration-200 p-1.5 rounded-lg hover:bg-red-50 flex items-center justify-center"
                        onClick={() => openDeleteModal(comment._id)}
                        title={ciText("Delete comment")}
                      >
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                    <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {comment.text}
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                    <div className="text-gray-400 mb-2">
                      <MessageCircle size={48} className="mx-auto opacity-50" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">
                      {ciText("No comments yet")}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {ciText("Be the first to add a comment!")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteModal.isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center mb-4 text-red-500">
              <AlertTriangle size={24} className="mr-2" />
              <h3 className="text-lg font-medium">{ciText("Delete Comment")}</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {ciText(
                "Are you sure you want to delete this comment? This action cannot be undone.",
              )}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                onClick={closeDeleteModal}
              >
                {ciText("Cancel")}
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium shadow-sm hover:shadow-md"
                onClick={handleDeleteComment}
              >
                {ciText("Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentModal;
