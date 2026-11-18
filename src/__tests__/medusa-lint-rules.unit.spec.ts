import { ESLint } from "eslint"

// Guards the lint setup: Medusa's ESLint rules must stay active next to Biome.
describe("Medusa ESLint rules", () => {
  it("rejects a lowercase route handler export", async () => {
    const eslint = new ESLint({ cwd: process.cwd() })

    const [result] = await eslint.lintText(
      "export const get = async () => {}\n",
      { filePath: "src/api/store/probe/route.ts" },
    )

    expect(result.messages.map((message) => message.ruleId)).toContain(
      "@medusajs/route-handler-exports-uppercase",
    )
    expect(result.errorCount).toBeGreaterThan(0)
  })
})
