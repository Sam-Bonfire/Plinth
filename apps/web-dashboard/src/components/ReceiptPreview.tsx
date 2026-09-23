import { App, Button, Modal } from "antd";
import React from "react";

export interface OrderLineProp {
  name: string;
  qty: number;
  price_minor: number;
}

export interface OrderProp {
  store_name: string;
  lines: OrderLineProp[];
  tax_minor: number;
  total_minor: number;
  txn_id: string;
  timestamp: string;
}

const WIDTH = 42;

const padCenter = (text: string, width: number): string => {
  if (text.length >= width) return text.substring(0, width);
  const left = Math.floor((width - text.length) / 2);
  const right = width - text.length - left;
  return " ".repeat(left) + text + " ".repeat(right);
};

const padLeftRight = (left: string, right: string, width: number): string => {
  const pad = width - left.length - right.length;
  if (pad < 1) {
    // If it doesn't fit, truncate left string
    const truncLeft = left.substring(0, width - right.length - 1);
    return truncLeft + " " + right;
  }
  return left + " ".repeat(pad) + right;
};

const moneyStr = (minor: number): string => {
  return (minor / 100).toFixed(2);
};

export const formatReceiptLines = (order: OrderProp): string[] => {
  const lines: string[] = [];

  // Header
  lines.push(padCenter(order.store_name, WIDTH));
  lines.push("");
  lines.push("-".repeat(WIDTH));

  // Items
  let subtotal = 0;
  for (const line of order.lines) {
    const totalMinor = line.qty * line.price_minor;
    subtotal += totalMinor;

    const left = `${line.name} x${line.qty}`;
    const right = moneyStr(totalMinor);
    lines.push(padLeftRight(left, right, WIDTH));
  }

  lines.push("-".repeat(WIDTH));

  // Totals
  lines.push(padLeftRight("SUBTOTAL", moneyStr(subtotal), WIDTH));
  lines.push(padLeftRight("TAX", moneyStr(order.tax_minor), WIDTH));
  lines.push(padLeftRight("TOTAL", moneyStr(order.total_minor), WIDTH));

  lines.push("-".repeat(WIDTH));

  // Footer
  lines.push(padCenter(`TXN: ${order.txn_id}`, WIDTH));
  lines.push(padCenter(order.timestamp, WIDTH));

  return lines;
};

export interface ReceiptPreviewProps {
  order: OrderProp | null;
  onClose: () => void;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ order, onClose }) => {
  const { message } = App.useApp();

  if (!order) return null;

  const lines = formatReceiptLines(order);
  const textContent = lines.join("\n");

  const handlePrint = (): void => {
    window.print();
  };

  const handleCopy = (): void => {
    navigator.clipboard.writeText(textContent).then(() => {
      message.success("Receipt text copied to clipboard");
    }).catch(() => {
      message.error("Failed to copy receipt text");
    });
  };

  return (
    <Modal
      title="Receipt Preview"
      open={true}
      onCancel={onClose}
      footer={[
        <Button key="copy" onClick={handleCopy}>
          Copy Text
        </Button>,
        <Button key="print" type="primary" onClick={handlePrint}>
          Print
        </Button>,
      ]}
      width={400}
    >
      <div style={{ background: "#f5f5f5", padding: "16px", borderRadius: "4px" }}>
        <pre
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "1.2",
            margin: 0,
            whiteSpace: "pre",
            overflowX: "auto",
          }}
        >
          {textContent}
        </pre>
      </div>
    </Modal>
  );
};
