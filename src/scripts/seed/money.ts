import { MedusaError } from "@medusajs/framework/utils"

/**
 * Converts F1 integer céntimos to Medusa major units (ADR 0001).
 *
 * The decimal string is built from integer parts and parsed, never divided as
 * floats, so 115 céntimos is exactly 1.15. A value that is not a whole number
 * of céntimos fails: a rounded price would differ from what the owner meant.
 */
export function centimosToMajor(centimos: number): number {
  if (!Number.isSafeInteger(centimos) || centimos < 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `A price must be a whole number of céntimos of 0 or more, got ${centimos}`,
    )
  }
  const units = Math.trunc(centimos / 100)
  const cents = String(centimos % 100).padStart(2, "0")
  return Number(`${units}.${cents}`)
}
