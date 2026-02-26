import React from "react";
import { Box, Text, useInput } from "ink";
function TrustConfirm({ item, warnings, onConfirm, onCancel }) {
  useInput((input, key) => {
    if (input === "y" || input === "Y") onConfirm();
    else if (input === "n" || input === "N" || key.escape) onCancel();
  });
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Dispatch #", item.number, " (", item.type, ")")), warnings.map((w, i) => /* @__PURE__ */ React.createElement(Box, { key: i, flexDirection: "column", marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "\u26A0 ", w.message), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "  ", w.detail))), /* @__PURE__ */ React.createElement(Text, null, "Proceed? ", /* @__PURE__ */ React.createElement(Text, { bold: true, color: "green" }, "y"), "/", /* @__PURE__ */ React.createElement(Text, { bold: true, color: "red" }, "n")));
}
export {
  TrustConfirm as default
};
