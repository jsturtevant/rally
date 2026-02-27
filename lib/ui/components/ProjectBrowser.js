import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { listOnboardedRepos } from "../../picker.js";
function ProjectBrowser({ onSelectProject, onAddProject, onBack, terminalRows, _listOnboardedRepos }) {
  const listRepos = _listOnboardedRepos || listOnboardedRepos;
  const [selectedIndex, setSelectedIndex] = useState(0);
  let projects = [];
  let error = null;
  try {
    projects = listRepos();
  } catch (err) {
    error = err.message;
  }
  const items = [
    ...projects.map((p) => ({ type: "project", label: p.repo || p.name, project: p })),
    { type: "add", label: "+ Add Project" }
  ];
  useInput((input, key) => {
    if (key.escape || input === "q") {
      onBack();
      return;
    }
    if (error) return;
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (key.return) {
      const selected = items[selectedIndex];
      if (selected.type === "add") {
        onAddProject();
      } else {
        onSelectProject(selected.project);
      }
    }
  });
  if (error) {
    return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { color: "red" }, "\u2717 ", error)), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Esc back")));
  }
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", justifyContent: "space-between", borderStyle: "round", borderColor: "gray", paddingX: 1, height: terminalRows }, /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Select a Project")), items.map((item, i) => /* @__PURE__ */ React.createElement(Box, { key: item.label }, /* @__PURE__ */ React.createElement(Text, { color: "cyan" }, i === selectedIndex ? "\u276F " : "  "), /* @__PURE__ */ React.createElement(Text, { bold: i === selectedIndex, color: item.type === "add" ? "green" : void 0 }, item.label)))), /* @__PURE__ */ React.createElement(Box, { justifyContent: "center" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "\u2191/\u2193 navigate \xB7 Enter select \xB7 Esc back")));
}
export {
  ProjectBrowser as default
};
