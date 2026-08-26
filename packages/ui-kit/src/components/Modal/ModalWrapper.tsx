import { Modal } from "antd";
import React, { ReactNode } from "react";

export interface ModalWrapperProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  footerActions?: ReactNode;
  fullscreenMobile?: boolean;
  children: ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  open,
  title,
  onClose,
  footerActions,
  fullscreenMobile,
  children,
}) => {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={footerActions}
      maskClosable={true}
      centered
      transitionName="ant-zoom"
      maskTransitionName="ant-fade"
      width={fullscreenMobile ? "100%" : 520}
      style={fullscreenMobile ? { maxWidth: "100%", margin: 0, padding: 0, top: 0, bottom: 0, height: "100vh" } : undefined}
      styles={{
        body: fullscreenMobile ? { height: "calc(100vh - 110px)", overflowY: "auto" } : undefined
      }}
    >
      {children}
    </Modal>
  );
};
