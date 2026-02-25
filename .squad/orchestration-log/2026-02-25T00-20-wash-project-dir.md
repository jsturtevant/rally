# Orchestration: Wash — Default Project Directory Change

**Timestamp:** 2026-02-25T00:20Z  
**Agent:** Wash (Integration Dev)  
**Mode:** sync  
**Issue:** #221  
**PR:** #226  

## Work

Changed default project directory from `~/.rally` (dotfile) to `~/rally` to avoid VSCode/Copilot trust workspace conflicts. Implemented backward-compatible fallback logic in `getConfigDir()`.

## Outcome

✅ PR #226 merged. Docs updated. Backward compatibility preserved for existing users.
