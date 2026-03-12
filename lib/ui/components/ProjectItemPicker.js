import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { fetchIssues, fetchPrs } from "../../picker.js";
function resolveRepo(project) {
  const repo = project.repo;
  if (!repo || !repo.includes("/")) return null;
  return repo;
}
function ProjectItemPicker({ project, onSelectItem, onNewBranch, onBack, terminalRows, _fetchIssues, _fetchPrs }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const repo = resolveRepo(project);
  const _fi = _fetchIssues || fetchIssues;
  const _fp = _fetchPrs || fetchPrs;
  useEffect(() => {
    if (!repo) {
      setError(`Invalid repo format: "${project.repo || project.name}". Expected "owner/repo".`);
      return;
    }
    setError(null);
    setData(null);
    setWarnings([]);
    setSelectedIndex(0);
    const w = [];
    let issues = [];
    let prs = [];
    try {
      issues = _fi(repo);
    } catch (err) {
      w.push(err.message);
    }
    try {
      prs = _fp(repo);
    } catch (err) {
      w.push(err.message);
    }
    setWarnings(w);
    setData({ issues, prs });
  }, [repo, _fi, _fp]);
  const items = data ? [
    { itemType: "new-branch", label: "+ Dispatch new branch" },
    ...data.issues.map((i) => ({ ...i, itemType: "issue" })),
    ...data.prs.map((p) => ({ ...p, itemType: "pr" }))
  ] : [];
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onBack();
      return;
    }
    if (!data || items.length === 0) return;
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (key.return) {
      const selected = items[selectedIndex];
      if (selected.itemType === "new-branch") {
        if (onNewBranch) onNewBranch(repo);
      } else {
        onSelectItem(selected, repo);
      }
    }
  });
  if (error) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error)), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Esc back")));
  }
  if (!data) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Loading issues and PRs for ", repo, "\u2026")), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Esc back")));
  }
  const hasIssuePrs = data && (data.issues.length > 0 || data.prs.length > 0);
  if (data && !hasIssuePrs) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, repo)), warnings.length > 0 ? warnings.map((w) => /* @__PURE__ */ React.createElement(Text, { key: w, color: "yellow" }, "\u26A0 ", w)) : /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "No open issues or pull requests"), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, selectedIndex === 0 ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: selectedIndex === 0, color: "green" }, "+ Dispatch new branch"))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Enter dispatch \xB7 Esc back")));
  }
  const newBranchIdx = 0;
  let flatIndex = 1;
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, repo), /* @__PURE__ */ React.createElement(Text, null, " \u2014 select an issue, PR, or start a new branch")), warnings.map((w) => /* @__PURE__ */ React.createElement(Text, { key: w, color: "yellow" }, "\u26A0 ", w)), /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, selectedIndex === newBranchIdx ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: selectedIndex === newBranchIdx, color: "green" }, "+ Dispatch new branch")), data.issues.length > 0 && /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: "yellow" }, "Issues"), data.issues.map((issue) => {
    const idx = flatIndex++;
    const labels = issue.labels && issue.labels.length ? ` [${issue.labels.map((l) => l.name).join(", ")}]` : "";
    return /* @__PURE__ */ React.createElement(Box, { key: `issue-${issue.number}` }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, idx === selectedIndex ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: idx === selectedIndex, wrap: "truncate" }, "#", issue.number, " ", issue.title, labels));
  })), data.prs.length > 0 && /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: "yellow" }, "Pull Requests"), data.prs.map((pr) => {
    const idx = flatIndex++;
    return /* @__PURE__ */ React.createElement(Box, { key: `pr-${pr.number}` }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, idx === selectedIndex ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: idx === selectedIndex, wrap: "truncate" }, "#", pr.number, " ", pr.title));
  }))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "\u2191/\u2193 navigate \xB7 Enter dispatch \xB7 Esc back")));
}
export {
  ProjectItemPicker as default
};
