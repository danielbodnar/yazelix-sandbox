# Yazelix Roadmap (Proposed)

As of 2026-02-08.

## Prioritized Order

1. `yzx` command palette + config UX
2. Rust Zellij plugin MVP (targeted scope)
3. Pane behavior hardening (drift + cwd consistency), powered by plugin
4. Packaging-readiness refactor (nixpkgs-friendly structure)
5. Packaging and distribution (first-party + nixpkgs)
6. Website/docs pass (with short gifs)
7. Broader Rust/clap rewrite only after boundaries are proven

## Why This Order

- Highest leverage with lowest risk first: command UX.
- Stabilize runtime behavior before adding packaging/distribution complexity.
- Accept that pane drift is likely not fully solvable from Nushell heuristics alone.
- Use Rust where it removes concrete fragility (pane state/orchestration), not as a blanket rewrite.

## Milestone 1: Command UX Foundation

### Goal
Make Yazelix commands discoverable and fast to run from anywhere.

### Scope
- Add `yzx menu` (interactive command launcher).
- Add `yzx config edit`, `yzx config view`, `yzx config reload`.
- Add a Zellij keybind (candidate: `Ctrl y`) to open the command launcher.
- Keep shell completions aligned with new commands.

### Related Issues
- `#277` add yzx config view/reload
- `#265` open yazelix config from helix

### Success Criteria
- Any user can discover and run major `yzx` actions without memorizing flags.
- Config editing/reloading has a single obvious path.

### Risk
- Low. Mostly CLI and keybinding integration.

## Milestone 2: Rust Zellij Plugin MVP

### Goal
Move the stateful pane orchestration logic to a safer, testable core.

### Scope
- Build a minimal plugin focused on pane tracking/focus primitives.
- Keep Nushell orchestration around it (no big-bang rewrite).
- Start with the smallest feature slice needed to remove drift-prone logic.

### Related Issues
- `#167` zellij plugin motivation (faster pane finding, stable placement)

### Success Criteria
- Reduced pane-management complexity in Nushell scripts.
- Plugin owns pane identity/focus decisions used by open-file flows.

### Risk
- Medium-high. Plugin APIs are still evolving.

## Milestone 3: Pane Determinism and CWD Consistency

### Goal
Make pane behavior predictable when opening files and creating new panes.

### Scope
- Replace heuristic pane traversal with plugin-backed targeting.
- Track/focus editor pane deterministically through plugin state.
- Define cwd policy for new panes in a tab after file-open flows.
- Ensure behavior is consistent whether editor instance is reused or newly spawned.

### Related Issues
- `#369` cwd for new panes after navigating/opening from Yazi
- `#167` Create a Yazelix Zellij plugin

### Success Criteria
- No pane “drift” during common open/edit flows.
- New panes open in expected project cwd inside the tab.

### Risk
- Medium. Touches core integration behavior.

## Milestone 4: Packaging-Readiness Refactor

### Goal
Refactor project structure and entrypoints so packaging is straightforward and low-risk.

### Scope
- Separate packaging concerns from user-local runtime concerns.
- Minimize hardcoded path assumptions and document packaging contracts clearly.
- Define stable install/runtime entrypoints for packaged environments.
- Add/refresh checks to validate package-mode behavior before upstream submission.

### Related Issues
- `#232` Package Yazelix as a Nix flake and Home Manager module

### Success Criteria
- Repo is structured so packaging does not require invasive patches.
- Package assumptions are explicit and testable.

### Risk
- Medium. Refactor risk, but high long-term payoff.

## Milestone 5: Packaging and Distribution

### Goal
Ship supported package paths, then pursue nixpkgs contribution.

### Scope
- First-class flake + Home Manager path in-repo.
- Cross-platform validation (Linux + macOS).
- Prepare and submit nixpkgs package/update iterations.

### Related Issues
- `#232` Package Yazelix as a Nix flake and Home Manager module
- `#367` macOS trusted-users onboarding friction

### Success Criteria
- Reproducible install path with clear upgrade story.
- Nixpkgs packaging effort is mostly process/review, not heavy refactor.

### Risk
- Medium-high. Process and maintenance heavy.

## Milestone 6: Website and Docs Experience

### Goal
Improve learnability and conversion with practical docs and visuals.

### Scope
- Structure docs around common workflows.
- Add short, focused gifs per feature.
- Keep docs synced with actual commands/behavior.

### Success Criteria
- Faster onboarding and fewer “how do I…” issues.

### Risk
- Low-medium. Mostly execution and maintenance.

## Milestone 7: Architecture Evolution (Optional, Later)

### Goal
Reassess `yzx` implementation boundaries after Milestones 1-6 data.

### Scope
- Evaluate `clap` rewrite for CLI only if clear payback.
- Consider backend/frontend split only after stable interfaces exist.

### Success Criteria
- Rewrite is justified by measured maintenance and reliability gains.

### Risk
- High if done too early; manageable if deferred.

## What Not To Do Yet

- No full Nushell-to-Rust rewrite now.
- No nixpkgs-first strategy before behavior stabilization.
- No broad plugin scope before a narrow MVP proves value.

## Next Action

Start Milestone 1 with a short implementation issue set:

1. `yzx menu` command
2. `yzx config edit/view/reload`
3. Zellij keybind to launch menu
4. Tests/docs update for new command surface

Then start Milestone 2 with a plugin spike:

1. Define plugin responsibilities (pane identity/focus/cwd state)
2. Build minimal plugin prototype wired to one open-file path
3. Measure drift/cwd behavior versus current Nushell-only logic
