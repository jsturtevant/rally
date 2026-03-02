import React from "react";
import { Text } from "ink";
const types = {
  success: { icon: "\u2713", color: "green" },
  error: { icon: "\u2717", color: "red" },
  warning: { icon: "\u26A0", color: "yellow" },
  skip: { icon: "\u2298", color: "gray" }
};
function StatusMessage({ type, children }) {
  const config = types[type];
  if (!config) return null;
  return /* @__PURE__ */ React.createElement(Text, { color: config.color }, config.icon, " ", children);
}
export {
  StatusMessage as default
};
