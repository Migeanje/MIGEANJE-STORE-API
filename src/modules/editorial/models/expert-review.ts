import { model } from "@medusajs/framework/utils"
import ReviewRubric from "./review-rubric"
import RubricScore from "./rubric-score"

/** The store's opinion on one product. Linked to one product. */
const ExpertReview = model
  .define("expert_review", {
    id: model.id({ prefix: "exrev" }).primaryKey(),
    verdict: model.text(),
    for_whom: model.array(),
    not_for: model.array(),
    rubric: model.belongsTo(() => ReviewRubric, { mappedBy: "reviews" }),
    scores: model.hasMany(() => RubricScore, { mappedBy: "review" }),
  })
  .cascades({ delete: ["scores"] })
  .checks([
    (columns) =>
      `length(btrim(${columns.verdict})) > 0 AND char_length(${columns.verdict}) <= 240`,
  ])

export default ExpertReview
