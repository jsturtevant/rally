import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState("path");
  const [repoPath, setRepoPath] = useState("");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  function runOnboard(path) {
    setStep("running");
    setStatus("onboarding");
    setError(null);
    Promise.resolve(onSubmit(path)).then(() => setStatus("done")).catch((err) => {
      setError(err.message || String(err));
      setStatus("error");
    });
  }
  useInput((input, key) => {
    if (status === "done" || status === "error") {
      onBack();
      return;
    }
    if (step === "running") return;
    if (key.escape) {
      onBack();
      return;
    }
    if (step === "path") {
      if (key.return) {
        const trimmed = repoPath.trim();
        if (!trimmed) {
          setError("Please enter a GitHub URL, owner/repo, or local path");
          return;
        }
        setError(null);
        runOnboard(trimmed);
        return;
      }
      if (key.backspace || key.delete) {
        setRepoPath((v) => v.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setRepoPath((v) => v + input);
        setError(null);
      }
    }
  });
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Add Project")), /* @__PURE__ */ React.createElement(Text, null, "GitHub URL, owner/repo, or local path:"), /* @__PURE__ */ React.createElement(Box, { marginTop: step === "path" ? 1 : 0 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "path" ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "path" }, repoPath || (step === "path" ? "" : "\u2026")), step === "path" && /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588")), error && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error)), status === "onboarding" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "Onboarding\u2026")), status === "done" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "green" }, "\u2713 Project onboarded successfully! Press any key to continue."))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Enter submit \xB7 Esc back")));
}
export {
  OnboardInput as default
};
