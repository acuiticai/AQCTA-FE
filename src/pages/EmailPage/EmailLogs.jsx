import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableCell,
  TableContainer,
  TableBody,
  TableRow,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@windmill/react-ui";
import { FiSearch, FiEye } from "react-icons/fi";
import { Button, DropdownBasic, PageHeader, InputField } from "@/page-layouts";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const EmailLogs = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${Base_URL}/email-logs`);
      setLogs(response.data);
      setFilteredLogs(response.data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const handleSearch = (e) => {
    if (e) {
      e.preventDefault();
    }
    let filtered = logs.filter((log) =>
      log.recipient.toLowerCase().includes(searchText.toLowerCase())
    );
    if (filterStatus) {
      filtered = filtered.filter((log) => log.status === filterStatus);
    }
    setFilteredLogs(filtered);
  };

  const clearFilters = () => {
    setSearchText("");
    setFilterStatus("");
    setFilteredLogs(logs);
  };

  const openModal = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
  };

  return (
    <div className="w-full container py-8 px-8">
      <PageHeader title={t("emailLogs.title")} />

      <Card>
        <CardBody>
          <form onSubmit={handleSearch} className="flex gap-4 justify-end mb-4">
            <InputField
              placeholder={t("emailLogs.searchRecipient")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />

            <DropdownBasic
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              placeholder={t("emailLogs.selectStatus")}
              options={[
                { value: "Sent", label: t("emailLogs.sent") },
                { value: "Failed", label: t("emailLogs.failed") },
              ]}
            />

            <Button
              type="submit"
              label={
                <div className="flex items-center gap-2">
                  <FiSearch />
                  <span>{t("emailLogs.search")}</span>
                </div>
              }
            />

            <Button
              type="button"
              secondary
              onClick={clearFilters}
              label={t("emailLogs.clearAll")}
            />
          </form>

          <TableContainer className="mt-4">
            <Table>
              <TableHeader>
                <tr>
                  <TableCell>{t("emailLogs.recipient")}</TableCell>
                  <TableCell>{t("emailLogs.subject")}</TableCell>
                  <TableCell>{t("emailLogs.status")}</TableCell>
                  <TableCell>{t("emailLogs.date")}</TableCell>
                  <TableCell>{t("emailLogs.actions")}</TableCell>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>{log.recipient}</TableCell>
                    <TableCell>{log.subject}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-md text-sm font-semibold ${
                          log.status === "Sent"
                            ? "text-green-700 bg-green-100"
                            : "text-red-700 bg-red-100"
                        }`}
                      >
                        {log.status === "Sent" ? t("emailLogs.sent") : t("emailLogs.failed")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="flex justify-center">
                      <button
                        className="p-2 hover:text-blue-600 transition-colors"
                        onClick={() => openModal(log)}
                      >
                        <FiEye size={20} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardBody>
      </Card>

      {selectedLog && (
        <Modal isOpen={isModalOpen} onClose={closeModal}>
          <ModalHeader>{t("emailLogs.logDetails")}</ModalHeader>
          <ModalBody>
            <div className="space-y-4 mt-6">
              <div>
                <strong className="text-gray-700">{t("emailLogs.recipient")}:</strong>
                <p>{selectedLog.recipient}</p>
              </div>
              <div>
                <strong className="text-gray-700">{t("emailLogs.subject")}:</strong>
                <p>{selectedLog.subject}</p>
              </div>
              <div>
                <strong className="text-gray-700">{t("emailLogs.status")}:</strong>
                <p>{selectedLog.status === "Sent" ? t("emailLogs.sent") : t("emailLogs.failed")}</p>
              </div>
              <div>
                <strong className="text-gray-700">{t("emailLogs.content")}:</strong>
                <p className="whitespace-pre-wrap">{selectedLog.content}</p>
              </div>
              <div>
                <strong className="text-gray-700">{t("emailLogs.date")}:</strong>
                <p>{new Date(selectedLog.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button secondary onClick={closeModal} label={t("emailLogs.close")} />
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};

export default EmailLogs;
