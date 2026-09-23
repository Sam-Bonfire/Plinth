import { type MenuItem } from "@plinth/ui-kit";
import { App, Button, Modal, Steps, Table, Typography, Upload } from "antd";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import React, { useState } from "react";
import { type CsvError, type ParsedItem, exportMenuToCsv, parseMenuCsv } from "./MenuCsvUtils.js";

interface MenuCsvWizardProps {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  onImport: (items: ParsedItem[]) => void;
}

export const MenuCsvWizard: React.FC<MenuCsvWizardProps> = ({ open, onClose, items, onImport }) => {
  const { message } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseErrors, setParseErrors] = useState<CsvError[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleExport = (): void => {
    try {
      const csvString = exportMenuToCsv(items);
      const blob = new Blob([csvString], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "menu_export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      void message.success("Menu exported successfully.");
      setCurrentStep(1);
    } catch (e) {
      void message.error("Failed to export menu.");
    }
  };

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === "string") {
          const { validItems, errors } = parseMenuCsv(text);
          setParsedItems(validItems);
          setParseErrors(errors);
          if (errors.length > 0) {
            void message.warning(`Found ${errors.length} errors in CSV file.`);
          } else {
            void message.success(`Parsed ${validItems.length} valid items.`);
          }
        }
      };
      reader.readAsText(file);
      return false; // Prevent auto-upload
    },
    onRemove: () => {
      setParsedItems([]);
      setParseErrors([]);
      setFileList([]);
    },
    fileList,
    onChange: (info) => {
      setFileList(info.fileList);
    },
    accept: ".csv",
    maxCount: 1,
  };

  const handleConfirmImport = (): void => {
    if (parsedItems.length === 0) {
      void message.error("No valid items to import.");
      return;
    }
    onImport(parsedItems);
    handleClose();
  };

  const handleClose = (): void => {
    setCurrentStep(0);
    setParsedItems([]);
    setParseErrors([]);
    setFileList([]);
    onClose();
  };

  const columns = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "Name", dataIndex: "name", key: "name" },
    { title: "Price", dataIndex: "price", key: "price" },
    { title: "Category", dataIndex: "categoryId", key: "categoryId" },
    {
      title: "Available",
      dataIndex: "isAvailable",
      key: "isAvailable",
      render: (val: boolean) => (val ? "Yes" : "No"),
    },
  ];

  return (
    <Modal
      title="Menu CSV Import/Export"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      <Steps
        current={currentStep}
        items={[
          { title: "Export", description: "Download current menu" },
          { title: "Import", description: "Upload modified CSV" },
        ]}
        style={{ marginBottom: 24 }}
      />

      {currentStep === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Typography.Paragraph>
            Download your current menu as a CSV file. You can modify it in a spreadsheet application and upload it in the next step.
          </Typography.Paragraph>
          <Button type="primary" onClick={handleExport}>
            Download CSV
          </Button>
          <div style={{ marginTop: 16 }}>
            <Button type="link" onClick={() => setCurrentStep(1)}>
              Skip to Import
            </Button>
          </div>
        </div>
      )}

      {currentStep === 1 && (
        <div>
          <Upload.Dragger {...uploadProps}>
            <Typography.Text>Click or drag CSV file to this area to upload</Typography.Text>
          </Upload.Dragger>

          {parseErrors.length > 0 && (
            <div style={{ marginTop: 16, color: "red" }}>
              <Typography.Text type="danger" strong>
                Validation Errors:
              </Typography.Text>
              <ul style={{ maxHeight: 100, overflowY: "auto" }}>
                {parseErrors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsedItems.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text strong>Valid Items to Import ({parsedItems.length}):</Typography.Text>
              <Table
                dataSource={parsedItems}
                columns={columns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5 }}
                style={{ marginTop: 8 }}
              />
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <Button onClick={() => setCurrentStep(0)} style={{ marginRight: 8 }}>
                  Back
                </Button>
                <Button type="primary" onClick={handleConfirmImport}>
                  Confirm Import
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
