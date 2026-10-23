import { message } from "antd";
import { afterEach } from "vitest";

afterEach(() => {
  message.destroy();
});
