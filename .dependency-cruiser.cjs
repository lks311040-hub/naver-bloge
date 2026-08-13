/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "scheduler-must-not-import-automation",
      comment:
        "The scheduler must never be able to reach Playwright/automation code — " +
        "publishing can only ever be a human clicking the button in an already-open " +
        "browser window (see server/src/modules/automation/editorAutofill.ts). This " +
        "rule is the *structural* enforcement of that: if anyone ever adds an import " +
        "from scheduler into automation, `npm run verify` fails right here instead of " +
        "relying on code review to catch it.",
      severity: "error",
      from: { path: "^server/src/modules/scheduler" },
      to: { path: "^server/src/modules/automation" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    exclude: { path: "node_modules" },
  },
};
