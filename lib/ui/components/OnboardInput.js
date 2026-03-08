import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState("path");
  const [repoPath, setRepoPath] = useState("");
  const [isFork, setIsFork] = useState(false);
  const [forkValue, setForkValue] = useState("");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  function runOnboard() {
    setStep("running");
    setStatus("onboarding");
    setError(null);
    const opts = {
      path: repoPath.trim(),
      fork: isFork ? forkValue.trim() || "auto" : void 0
    };
    Promise.resolve(onSubmit(opts)).then(() => setStatus("done")).catch((err) => {
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
      if (step === "fork-toggle") {
        setStep("path");
        return;
      }
      if (step === "fork-input") {
        setStep("fork-toggle");
        return;
      }
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
        setStep("fork-toggle");
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
      return;
    }
    if (step === "fork-toggle") {
      if (key.leftArrow || key.rightArrow || input === " ") {
        setIsFork((v) => !v);
        return;
      }
      if (key.return) {
        if (isFork) {
          setStep("fork-input");
        } else {
          runOnboard();
        }
        return;
      }
      return;
    }
    if (step === "fork-input") {
      if (key.return) {
        runOnboard();
        return;
      }
      if (key.backspace || key.delete) {
        setForkValue((v) => v.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setForkValue((v) => v + input);
        setError(null);
      }
      return;
    }
  });
  const showPath = step === "path" || step === "fork-toggle" || step === "fork-input" || step === "running";
  const showForkToggle = step === "fork-toggle" || step === "fork-input" || step === "running";
  const showForkInput = (step === "fork-input" || step === "running") && isFork;
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Add Project")), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "path" }, "GitHub URL, owner/repo, or local path:"), /* @__PURE__ */ React.createElement(Box, { marginTop: step === "path" ? 1 : 0 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "path" ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "path" }, repoPath || (step === "path" ? "" : "\u2026")), step === "path" && /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588")), showForkToggle && /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "fork-toggle" }, "This is a fork:"), /* @__PURE__ */ React.createElement(Box, { marginTop: step === "fork-toggle" ? 1 : 0 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "fork-toggle" ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { color: isFork ? "green" : "gray" }, "[", isFork ? "\u2713" : " ", "]"), /* @__PURE__ */ React.createElement(Text, null, " ", isFork ? "Yes" : "No"), step === "fork-toggle" && /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "  (\u2190/\u2192 or space to toggle)"))), showForkInput && /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "fork-input" }, "Your fork (owner/repo) or leave empty for auto-detect:"), /* @__PURE__ */ React.createElement(Box, { marginTop: step === "fork-input" ? 1 : 0 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "fork-input" ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "fork-input" }, forkValue || (step === "fork-input" ? "" : "(auto)")), step === "fork-input" && /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588"))), error && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error)), status === "onboarding" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "Onboarding\u2026")), status === "done" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "green" }, "\u2713 Project onboarded successfully! Press any key to continue."))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, step === "path" && "Enter continue \xB7 Esc back", step === "fork-toggle" && "Enter continue \xB7 \u2190/\u2192 toggle \xB7 Esc back", step === "fork-input" && "Enter submit \xB7 Esc back", step === "running" && "")));
}
export {
  OnboardInput as default
};
