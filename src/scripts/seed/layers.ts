import { MedusaError } from "@medusajs/framework/utils"

/** The seed layers, in the order they run (docs/seed-plan.md, "Layers"). */
export const LAYERS = ["reference", "setup", "catalog", "demo"] as const
export type Layer = (typeof LAYERS)[number]

const isLayer = (value: string): value is Layer =>
  (LAYERS as readonly string[]).includes(value)

/**
 * The layers to run, in seed order whatever the argument order. No argument
 * runs every layer; an unknown name fails before anything is written.
 */
export function parseLayers(args: readonly string[]): Layer[] {
  const unknown = args.filter((arg) => !isLayer(arg))
  if (unknown.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      `Unknown seed layer: ${unknown.join(", ")}. Layers: ${LAYERS.join(", ")}.`,
    )
  }
  return args.length
    ? LAYERS.filter((layer) => args.includes(layer))
    : [...LAYERS]
}

/** The demo account is public by design: it never exists in production. */
export function assertDemoAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === "production") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "The demo layer refuses to run when NODE_ENV is production.",
    )
  }
}

export const DEMO_PASSWORD_VARIABLE = "SEED_DEMO_PASSWORD"

/** The demo password from the environment, 8 to 128 characters (ADR 0004). */
export function demoPassword(env: Record<string, string | undefined>): string {
  const password = env[DEMO_PASSWORD_VARIABLE]
  if (!password) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `The demo layer needs the ${DEMO_PASSWORD_VARIABLE} environment variable.`,
    )
  }
  if (password.length < 8 || password.length > 128) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${DEMO_PASSWORD_VARIABLE} must have 8 to 128 characters.`,
    )
  }
  return password
}
