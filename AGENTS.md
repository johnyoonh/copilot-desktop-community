Use `bd` for task tracking.

# Prompt completion verification

- Before every final response for work in this repository, run `npm run build`.
- After the build succeeds, quit any running `Copilot Desktop CE` process so verification cannot attach to a stale app.
- Launch the rebuilt installed app from `/Applications/Copilot Desktop CE.app`, not just the dev app from `npm start`, and confirm the visible app is using that installed bundle.
- For user-facing behavior changes, run or perform an end-to-end check of the changed behavior in addition to confirming startup. For find-bar/search changes, run `npm run verify:find`.
- Stop any app process launched for verification before the final response unless the user explicitly asks to leave it running.
- If the build, installed-app launch, or behavior verification cannot run, report the exact blocker and do not mark the work as fully verified.
