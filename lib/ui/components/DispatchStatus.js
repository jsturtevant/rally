import React from "react";
import { Box, Text } from "ink";
function DispatchStatus({ item, status, message }) {
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Dispatch #", item.number, " (", item.type, ")")), status === "dispatching" && /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "Dispatching..."), status === "done" && /* @__PURE__ */ React.createElement(Text, { color: "green" }, "\u2713 ", message), status === "error" && /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", message), (status === "done" || status === "error") && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Press any key to return")));
}
export {
  DispatchStatus as default
};
