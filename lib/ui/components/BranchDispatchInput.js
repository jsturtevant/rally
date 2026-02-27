import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
function BranchDispatchInput({ repo, terminalRows, onSubmit, onBack }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  useInput((input, key) => {
    if (status === "done" || status === "error") {
      onBack();
      return;
    }
    if (status === "dispatching") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (key.return) {
      const trimmed = value.trim();
      if (!trimmed) {
        setError("Please describe the task");
        return;
      }
      setStatus("dispatching");
      setError(null);
      Promise.resolve(onSubmit(trimmed)).then(() => setStatus("done")).catch((err) => {
        setError(err.message || String(err));
        setStatus("error");
      });
      return;
    }
    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setError(null);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
      setError(null);
    }
  });
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Dispatch New Branch"), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "  (", repo, ")")), /* @__PURE__ */ React.createElement(Text, null, "Describe the task:"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, "\u276F "), /* @__PURE__ */ React.createElement(Text, null, value), /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588")), error && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error)), status === "dispatching" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "Creating worktree and launching Copilot\u2026")), status === "done" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "green" }, "\u2713 Branch dispatched! Press any key to continue."))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Enter dispatch \xB7 Esc cancel")));
}
export {
  BranchDispatchInput as default
};
