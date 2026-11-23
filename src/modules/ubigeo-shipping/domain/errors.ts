/**
 * A broken shipping rule: a malformed date, an invalid day count or an
 * inverted day range. The domain stays free of framework errors; the module
 * service turns it into a `MedusaError` of type `invalid_data`.
 */
export class UbigeoShippingRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UbigeoShippingRuleError"
  }
}
