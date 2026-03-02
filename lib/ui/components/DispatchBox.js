import React from "react";
import { Box, Text } from "ink";
function DispatchBox({ title, children }) {
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", borderStyle: "round", paddingX: 1 }, title && /* @__PURE__ */ React.createElement(Text, { bold: true }, title), children);
}
export {
  DispatchBox as default
};
