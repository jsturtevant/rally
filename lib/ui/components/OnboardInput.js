import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState("path");
  const [repoPath, setRepoPath] = useState("");
  const [forkAnswer, setForkAnswer] = useState("");
  const [isFork, setIsFork] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  function runOnboard(useFork) {
    setStep("running");
    setStatus("onboarding");
    setError(null);
    const opts = useFork ? { path: repoPath.trim(), fork: "auto" } : { path: repoPath.trim() };
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
      if (step === "fork") {
        setStep("path");
        setForkAnswer("");
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
        setStep("fork");
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
    if (step === "fork") {
      if (key.return) {
        const answer = forkAnswer.trim().toLowerCase();
        if (answer === "y" || answer === "yes") {
          setIsFork(true);
          runOnboard(true);
        } else if (answer === "n" || answer === "no") {
          setIsFork(false);
          runOnboard(false);
        } else {
          setError("Please enter y or n");
        }
        return;
      }
      if (key.backspace || key.delete) {
        setForkAnswer((v) => v.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setForkAnswer((v) => v + input);
        setError(null);
      }
      return;
    }
  });
  const isRunning = step === "running";
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Add Project")), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "path" || isRunning }, "Upstream repository (GitHub URL, owner/repo, or local path):"), /* @__PURE__ */ React.createElement(Box, { marginTop: step === "path" && !isRunning ? 1 : 0 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "path" && !isRunning ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "path" || isRunning }, repoPath || (step === "path" && !isRunning ? "" : "\u2026")), step === "path" && !isRunning && /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588")), step === "fork" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, null, "Is this a fork? (y/n):"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, "\u276F "), /* @__PURE__ */ React.createElement(Text, null, forkAnswer), /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588"))), isRunning && /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Fork: ", isFork ? "auto-detect" : "No")), error && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error)), status === "onboarding" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "Onboarding\u2026")), status === "done" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "green" }, "\u2713 Project onboarded successfully! Press any key to continue."))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, step === "path" && "Enter continue \xB7 Esc back", step === "fork" && "Enter submit \xB7 Esc back", step === "running" && (status === "error" ? "Press any key to continue" : ""))));
}
export {
  OnboardInput as default
};
