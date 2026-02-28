import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
function OnboardInput({ terminalRows, onSubmit, onBack }) {
  const [step, setStep] = useState("path");
  const [repoPath, setRepoPath] = useState("");
  const [teamChoice, setTeamChoice] = useState(0);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const teamOptions = ["Use shared team", "Create new project team"];
  function runOnboard(path, team) {
    setStep("running");
    setStatus("onboarding");
    setError(null);
    Promise.resolve(onSubmit(path, team)).then(() => setStatus("done")).catch((err) => {
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
      if (step === "teamName") {
        setStep("team");
        setError(null);
        return;
      }
      if (step === "team") {
        setStep("path");
        setError(null);
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
        setStep("team");
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
    if (step === "team") {
      if (key.upArrow) {
        setTeamChoice(0);
        return;
      }
      if (key.downArrow) {
        setTeamChoice(1);
        return;
      }
      if (key.return) {
        if (teamChoice === 0) {
          runOnboard(repoPath.trim(), null);
        } else {
          setStep("teamName");
        }
        return;
      }
      return;
    }
    if (step === "teamName") {
      if (key.return) {
        const trimmed = teamName.trim();
        if (!trimmed) {
          setError("Team name is required");
          return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
          setError("Use only letters, numbers, hyphens, and underscores");
          return;
        }
        setError(null);
        runOnboard(repoPath.trim(), trimmed);
        return;
      }
      if (key.backspace || key.delete) {
        setTeamName((v) => v.slice(0, -1));
        setError(null);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setTeamName((v) => v + input);
        setError(null);
      }
    }
  });
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Add Project")), /* @__PURE__ */ React.createElement(Text, null, "GitHub URL, owner/repo, or local path:"), /* @__PURE__ */ React.createElement(Box, { marginTop: step === "path" ? 1 : 0 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "path" ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "path" }, repoPath || (step === "path" ? "" : "\u2026")), step === "path" && /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588")), (step === "team" || step === "teamName" || step === "running") && /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, null, "Select team type:"), teamOptions.map((opt, i) => /* @__PURE__ */ React.createElement(Box, { key: opt }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "team" && i === teamChoice ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: step === "team" && i === teamChoice, dimColor: step !== "team" }, opt)))), (step === "teamName" || step === "running" && teamName) && /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, null, "Team name:"), /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, step === "teamName" ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { dimColor: step !== "teamName" }, teamName), step === "teamName" && /* @__PURE__ */ React.createElement(Text, { color: "gray" }, "\u2588"))), error && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error)), status === "onboarding" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "yellow" }, "Onboarding\u2026")), status === "done" && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "green" }, "\u2713 Project onboarded successfully! Press any key to continue."))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, step === "team" ? "\u2191/\u2193 select \xB7 Enter confirm \xB7 Esc back" : "Enter submit \xB7 Esc back")));
}
export {
  OnboardInput as default
};
