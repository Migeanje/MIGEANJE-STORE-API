import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api }) => {
    describe("GET /health", () => {
      it("answers 200 once the application has booted", async () => {
        const response = await api.get("/health")

        expect(response.status).toEqual(200)
      })
    })
  },
})
