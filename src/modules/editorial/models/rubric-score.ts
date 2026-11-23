import { model } from "@medusajs/framework/utils"
import ExpertReview from "./expert-review"
import RubricCriterion from "./rubric-criterion"

/** One rubric line of a review: a criterion scored from 1 to 5. */
const RubricScore = model
  .define("rubric_score", {
    id: model.id({ prefix: "rvscore" }).primaryKey(),
    score: model.number(),
    note: model.text(),
    review: model.belongsTo(() => ExpertReview, { mappedBy: "scores" }),
    criterion: model.belongsTo(() => RubricCriterion, { mappedBy: "scores" }),
  })
  .indexes([{ on: ["review_id", "criterion_id"], unique: true }])
  .checks([
    {
      name: "rubric_score_score_range_check",
      expression: (columns) => `${columns.score} BETWEEN 1 AND 5`,
    },
    {
      name: "rubric_score_note_not_blank_check",
      expression: (columns) => `length(btrim(${columns.note})) > 0`,
    },
  ])

export default RubricScore
