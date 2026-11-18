const { loadEnv } = require("@medusajs/framework/utils")
loadEnv("test", process.cwd())

module.exports = {
  // Compiles the ESM-only packages Medusa depends on (see the AGENTS.md of
  // @medusajs/test-utils). Keeps the project's own transform below.
  preset: "@medusajs/test-utils",
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
}

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"]
} else if (process.env.TEST_TYPE === "integration:modules") {
  // Named *.integration.spec.ts so unit specs and helpers in a module's
  // __tests__/ folder are not picked up as module suites.
  module.exports.testMatch = [
    "**/src/modules/*/__tests__/**/*.integration.spec.[jt]s",
  ]
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"]
}
