import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import UbigeoShippingModule from "../modules/ubigeo-shipping"

// The delivery estimate promised when the order was placed, read with the
// order by the tracking, confirmation and account routes
// (docs/data-model/ubigeo-shipping.md).
export default defineLink(
  OrderModule.linkable.order,
  UbigeoShippingModule.linkable.deliveryEstimate,
)
