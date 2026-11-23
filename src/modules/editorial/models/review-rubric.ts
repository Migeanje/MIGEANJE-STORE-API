import { model } from "@medusajs/framework/utils"
import ExpertReview from "./expert-review"
import RubricCriterion from "./rubric-criterion"

/** The criteria one category is scored on. Linked to one product category. */
const ReviewRubric = model.define("review_rubric", {
  id: model.id({ prefix: "rvrub" }).primaryKey(),
  criteria: model.hasMany(() => RubricCriterion, { mappedBy: "rubric" }),
  reviews: model.hasMany(() => ExpertReview, { mappedBy: "rubric" }),
})

export default ReviewRubric
