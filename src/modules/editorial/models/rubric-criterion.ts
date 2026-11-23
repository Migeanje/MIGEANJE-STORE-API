import { model } from "@medusajs/framework/utils"
import ReviewRubric from "./review-rubric"
import RubricScore from "./rubric-score"

/** One criterion of a rubric, e.g. "Relación precio-calidad". */
const RubricCriterion = model
  .define("rubric_criterion", {
    id: model.id({ prefix: "rvcrit" }).primaryKey(),
    name: model.text(),
    rank: model.number(),
    rubric: model.belongsTo(() => ReviewRubric, { mappedBy: "criteria" }),
    scores: model.hasMany(() => RubricScore, { mappedBy: "criterion" }),
  })
  // Partial by default: `deleted_at IS NULL` (a deleted criterion frees them).
  .indexes([
    { on: ["rubric_id", "name"], unique: true },
    { on: ["rubric_id", "rank"], unique: true },
  ])
  .checks([(columns) => `${columns.rank} >= 0`])

export default RubricCriterion
