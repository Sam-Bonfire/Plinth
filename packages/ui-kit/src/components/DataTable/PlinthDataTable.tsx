import { Table, Input, Button, Space, Typography } from "antd";
import type { TableProps } from "antd";
import type { ColumnType } from "antd/es/table";
import React, { useMemo, useState } from "react";

const { Text } = Typography;

export interface PlinthColumnType<T> extends ColumnType<T> {
  searchable?: boolean;
  exportable?: boolean;
}

export interface PlinthDataTableProps<T extends Record<string, unknown>>
  extends Omit<TableProps<T>, "columns" | "dataSource" | "size"> {
  columns: PlinthColumnType<T>[];
  dataSource: T[];
  rowKey: keyof T | ((record: T) => string);
  searchable?: boolean;
  density?: "compact" | "comfortable" | "pos-touch";
  onExport?: (data: T[]) => void;
  loading?: boolean;
  emptyText?: string;
}

const accessibleTableComponents = {
  table: (props: React.TableHTMLAttributes<HTMLTableElement>) => <table {...props} role="table" />,
  header: {
     wrapper: (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} role="rowgroup" />,
     row: (props: React.HTMLAttributes<HTMLTableRowElement>) => <tr {...props} role="row" />,
     cell: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => <th {...props} role="columnheader" scope="col" />
  },
  body: {
     wrapper: (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} role="rowgroup" />,
  }
};

export const PlinthDataTable = <T extends Record<string, unknown>>({
  columns,
  dataSource,
  rowKey,
  searchable = false,
  density = "comfortable",
  onExport,
  loading = false,
  emptyText = "No data available",
  ...restProps
}: PlinthDataTableProps<T>): React.ReactElement => {
  const [searchText, setSearchText] = useState("");

  const size = useMemo(() => {
    switch (density) {
      case "compact":
        return "small";
      case "pos-touch":
        return "large";
      case "comfortable":
      default:
        return "middle";
    }
  }, [density]);

  const filteredData = useMemo(() => {
    if (!searchText || !searchable) {
      return dataSource;
    }

    const searchableColumns = columns.filter((col) => col.searchable);
    if (searchableColumns.length === 0) {
      return dataSource;
    }

    const lowerSearchText = searchText.toLowerCase();

    const getValueFromPath = (obj: Record<string, unknown>, path: string | readonly React.Key[]) => {
       if (Array.isArray(path)) {
           return path.reduce((acc: unknown, key) => (acc && typeof acc === 'object' && key in acc ? (acc as Record<string, unknown>)[key as string] : undefined), obj);
       }
       return obj[path as string];
    }

    return dataSource.filter((record) => {
      return searchableColumns.some((col) => {
        const dataIndex = col.dataIndex as keyof T | readonly React.Key[];
        if (!dataIndex) return false;

        const value = getValueFromPath(record, dataIndex);
        if (value == null) return false;

        return String(value).toLowerCase().includes(lowerSearchText);
      });
    });
  }, [dataSource, searchText, searchable, columns]);

  const handleExport = () => {
    if (onExport) {
      onExport(filteredData);
    }
  };

  return (
    <div className={`plinth-data-table-container density-${density}`}>
      {(searchable || onExport) && (
        <Space
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          {searchable ? (
            <Input.Search
              placeholder="Search..."
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              style={{ maxWidth: 300 }}
              role="searchbox"
            />
          ) : (
            <div />
          )}
          {onExport && (
            <Button onClick={handleExport} type="default">
              Export
            </Button>
          )}
        </Space>
      )}

      <Table<T>
        {...restProps}
        rowKey={rowKey}
        columns={columns}
        dataSource={filteredData}
        size={size}
        loading={loading}
        scroll={{ x: "max-content", ...restProps.scroll }}
        sticky={restProps.sticky !== undefined ? restProps.sticky : true}
        locale={{
          emptyText: <Text type="secondary">{emptyText}</Text>,
          ...restProps.locale,
        }}
        rowClassName={(record, index) => {
           const customClass = restProps.rowClassName
              ? (typeof restProps.rowClassName === 'function' ? restProps.rowClassName(record, index, 0) : restProps.rowClassName)
              : '';
           return `plinth-table-row ${customClass}`.trim();
        }}
        onRow={(record, index) => {
          const rowProps = restProps.onRow ? restProps.onRow(record, index) : {};
          return {
            ...rowProps,
            role: "row",
          }
        }}
        components={accessibleTableComponents}
      />
    </div>
  );
};

export const DataTable = PlinthDataTable;
