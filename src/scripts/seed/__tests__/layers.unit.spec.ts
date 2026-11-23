import {
  assertDemoAllowed,
  DEMO_PASSWORD_VARIABLE,
  demoPassword,
  LAYERS,
  parseLayers,
} from "../layers"

describe("seed layers", () => {
  it("lists the four layers in seed order", () => {
    expect(LAYERS).toEqual(["reference", "setup", "catalog", "demo"])
  })

  it("runs every layer without arguments", () => {
    expect(parseLayers([])).toEqual(["reference", "setup", "catalog", "demo"])
  })

  it("runs the requested layers in seed order, whatever the argument order", () => {
    expect(parseLayers(["catalog", "reference", "setup"])).toEqual([
      "reference",
      "setup",
      "catalog",
    ])
    expect(parseLayers(["setup", "setup"])).toEqual(["setup"])
  })

  it("rejects an unknown layer with the list of layers", () => {
    expect(() => parseLayers(["setup", "nope", "other"])).toThrow(
      "Unknown seed layer: nope, other. Layers: reference, setup, catalog, demo.",
    )
  })
})

describe("demo layer guards", () => {
  it("refuses to run when NODE_ENV is production", () => {
    expect(() => assertDemoAllowed("production")).toThrow(
      /demo layer.*production/i,
    )
  })

  it.each([undefined, "development", "staging", "test"])(
    "runs when NODE_ENV is %s",
    (env) => {
      expect(() => assertDemoAllowed(env)).not.toThrow()
    },
  )

  it("refuses to run without the demo password variable", () => {
    expect(() => demoPassword({})).toThrow(DEMO_PASSWORD_VARIABLE)
    expect(() => demoPassword({ [DEMO_PASSWORD_VARIABLE]: "" })).toThrow(
      DEMO_PASSWORD_VARIABLE,
    )
  })

  it("accepts 8 to 128 characters (ADR 0004) and nothing else", () => {
    expect(demoPassword({ [DEMO_PASSWORD_VARIABLE]: "12345678" })).toBe(
      "12345678",
    )
    expect(
      demoPassword({ [DEMO_PASSWORD_VARIABLE]: "a".repeat(128) }),
    ).toHaveLength(128)
    expect(() => demoPassword({ [DEMO_PASSWORD_VARIABLE]: "1234567" })).toThrow(
      /8 to 128/,
    )
    expect(() =>
      demoPassword({ [DEMO_PASSWORD_VARIABLE]: "a".repeat(129) }),
    ).toThrow(/8 to 128/)
  })

  it("never puts the password in the error", () => {
    expect.assertions(1)
    try {
      demoPassword({ [DEMO_PASSWORD_VARIABLE]: "short" })
    } catch (error) {
      expect(String(error)).not.toContain("short")
    }
  })
})
