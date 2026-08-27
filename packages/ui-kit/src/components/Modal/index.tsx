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
  fullscreenMobile = false,
  children,
}) => {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={footerActions}
      maskClosable={true}
      destroyOnHidden={true}
      centered={true}
      wrapClassName={fullscreenMobile ? "plinth-modal-fullscreen" : undefined}
      styles={{
        mask: {
          backdropFilter: "blur(4px)",
        },
      }}
    >
      {children}
    </Modal>
  );
};
