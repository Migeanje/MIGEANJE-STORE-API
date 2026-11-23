import { defineLink } from "@medusajs/framework/utils"
import FulfillmentModule from "@medusajs/medusa/fulfillment"
import UbigeoShippingModule from "../modules/ubigeo-shipping"

// Transit days belong to the shipping option the customer picks, one row per
// option (docs/data-model/ubigeo-shipping.md). Not a cascade: the transit row
// is the owner's rate data and is removed on purpose.
export default defineLink(
  FulfillmentModule.linkable.shippingOption,
  UbigeoShippingModule.linkable.transitTime,
)
