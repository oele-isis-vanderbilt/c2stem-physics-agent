/**
 * Scoring registry: one entry per lesson, chosen by the lessonId the lesson
 * card puts in the route (?lessonId=lesson1).
 *
 * A lesson entry has:
 *   id              lessonId
 *   parser          BlockParser that builds the AST string sent to the agent
 *   targetSprites   sprite names whose scripts are parsed and scored, or null for all
 *   initialScore()  score object with every rubric key at 0
 *   createScorer(store) -> { updateScore(ast, roots) }, dispatches "updateScore"
 *   createSegmenter(store)  optional; task segment parser (default SegmentParser)
 */
import truck from "@/services/scoring/lessons/truck";
import lesson1 from "@/services/scoring/lessons/lesson1";
import tree from "@/services/scoring/treeUtils";

const LESSONS = {
  [truck.id]: truck,
  [lesson1.id]: lesson1,
};

const DEFAULT_LESSON = truck.id;

function getLesson(lessonId) {
  return LESSONS[lessonId] || LESSONS[DEFAULT_LESSON];
}

// Scripts of the lesson's target sprites. If none of them is in the sprite
// map (e.g. the project XML could not be loaded), every script is kept.
function visibleRoots(lesson, store) {
  return tree.rootsOfSprites(store, lesson.targetSprites);
}

// AST string for the agent, built from the lesson's target sprites only
function generateState(lesson, store) {
  if (!lesson.targetSprites) {
    return lesson.parser.generate(store);
  }
  return lesson.parser.generate({
    getters: {
      getTreeRoots: visibleRoots(lesson, store),
      getBlocks: store.getters.getBlocks,
      getSprites: store.getters.getSprites,
    },
  });
}

export default {
  DEFAULT_LESSON,
  getLesson,
  visibleRoots,
  generateState,
};
