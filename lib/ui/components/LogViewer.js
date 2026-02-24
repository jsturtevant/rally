import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { readFileSync, existsSync } from "node:fs";
function LogViewer({ dispatch, onBack, visibleLines = 20, _readFile = readFileSync, _existsSync = existsSync }) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const lines = useMemo(() => {
    if (!dispatch.logPath || !_existsSync(dispatch.logPath)) {
      return ["No log file available."];
    }
    try {
      const content = _readFile(dispatch.logPath, "utf8");
      return content.split("\n");
    } catch {
      return ["Failed to read log file."];
    }
  }, [dispatch.logPath, _readFile, _existsSync]);
  const maxOffset = Math.max(0, lines.length - visibleLines);
  useInput((input, key) => {
    if (key.escape) {
      onBack();
    } else if (key.upArrow) {
      setScrollOffset((o) => Math.max(0, o - 1));
    } else if (key.downArrow) {
      setScrollOffset((o) => Math.min(maxOffset, o + 1));
    }
  });
  const visible = lines.slice(scrollOffset, scrollOffset + visibleLines);
  const issueRef = dispatch.type === "pr" ? `PR #${dispatch.number}` : `Issue #${dispatch.number}`;
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, /* @__PURE__ */ React.createElement(Box, { marginBottom: 1 }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Logs for "), /* @__PURE__ */ React.createElement(Text, { bold: true, color: "cyan" }, issueRef), /* @__PURE__ */ React.createElement(Text, { bold: true }, " (", dispatch.repo, ")")), /* @__PURE__ */ React.createElement(Box, { flexDirection: "column" }, visible.map((line, i) => /* @__PURE__ */ React.createElement(Text, { key: scrollOffset + i, wrap: "truncate" }, line))), /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "\u2191/\u2193 scroll \xB7 Esc back \xB7 Line ", scrollOffset + 1, "\u2013", Math.min(scrollOffset + visibleLines, lines.length), " of ", lines.length)));
}
export {
  LogViewer as default
};
