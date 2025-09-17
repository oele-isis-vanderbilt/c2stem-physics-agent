export default class ActionScorer {
  constructor(blocksName, treeRootsName, actionListName, store) {
    this.blocksName = blocksName;
    this.treeRootsName = treeRootsName;
    this.actionListName = actionListName;
    this.store = store;
  }
  scoringRubricListedObj = {
    positionInitialization: [],
    velocityInitialization: [],
    accelerationInitialization: [],
    deltaTInitialization: [],
    startSimulation: [],
    updatePosition: [],
    updateVelocity: [],
    updateOrder: [],
    accuracy: [],
    cruising: [],
    decelerating: [],
    stopping: [],
    cruisingConditional: [],
    slowingConditional: [],
    stoppingConditional: [],
    completeCruising: [],
    completeSlowDown: [],
    completeStopping: [],
    completeOrdering: [],
  };

  getMatchingBlock(ast, searchString) {
    let blocks = ast.split("\n");
    return blocks.filter((block) => block.includes(searchString));
  }

  getRootBlock(ast, searchString) {
    const sections = ast.split("\n\n");
    let greenFlagSection = "";
    let simulationStepSection = "";
    if (sections.length === 1) {
      const singleSection = sections[0];
      if (singleSection.includes("[when greenflag clicked]")) {
        greenFlagSection = singleSection;
      } else if (singleSection.includes("[simulation_step]")) {
        simulationStepSection = singleSection;
      }
    } else {
      sections.forEach((section) => {
        if (section.includes("[when greenflag clicked]")) {
          greenFlagSection = section;
        } else if (section.includes("[simulation_step]")) {
          simulationStepSection = section;
        }
      });
    }

    let result;

    if (greenFlagSection && greenFlagSection.includes(searchString)) {
      result = "greenflag clicked";
    } else if (
      simulationStepSection &&
      simulationStepSection.includes(searchString)
    ) {
      result = "simulation step";
    } else {
      result = null;
    }

    return result;
  }

  checkIfBeforeOrAfter(ast, searchText) {
    const lines = ast.split("\n");
    let searchIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        searchIndex = i;
        break;
      }
    }
    if (searchIndex === -1) {
      return `"${searchText}" not found in the AST.`;
    }

    let result;
    let beforeIfIndex = -1;
    let afterIfIndex = -1;

    // Check before the search text for an "if" statement
    for (let i = searchIndex - 1; i >= 0; i--) {
      if (lines[i].includes("[if")) {
        beforeIfIndex = i;
        break;
      }
    }

    // Check after the search text for an "if" statement
    for (let i = searchIndex + 1; i < lines.length; i++) {
      if (lines[i].includes("[if")) {
        afterIfIndex = i;
        break;
      }
    }

    if (beforeIfIndex !== -1 && afterIfIndex !== -1) {
      result = "both";
    } else if (beforeIfIndex !== -1) {
      result = "before";
    } else if (afterIfIndex !== -1) {
      result = "after";
    } else {
      result = null;
    }
    return result;
  }

  checkChangeOrder(ast) {
    const lines = ast.split("\n");

    let velocityIndex = -1;
    let positionIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("change velocity by") && velocityIndex === -1) {
        velocityIndex = i; // Store the index of "change velocity by"
      }
      if (lines[i].includes("change x_position by") && positionIndex === -1) {
        positionIndex = i; // Store the index of "change position by"
      }
    }

    if (velocityIndex === -1 || positionIndex === -1) {
      return `"change velocity by" or "change position by" not found in the AST.`;
    }

    if (velocityIndex < positionIndex) {
      return "before";
    } else if (velocityIndex > positionIndex) {
      return "after";
    } else {
      return "sameLink";
    }
  }

  findBlockAfterGreenFlag(ast, searchText) {
    const lines = ast.split("\n");

    let greenFlagIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("[when greenflag clicked]")) {
        greenFlagIndex = i;
        break;
      }
    }
    if (greenFlagIndex === -1) {
      return null;
    }

    for (let i = greenFlagIndex + 1; i < lines.length; i++) {
      if (lines[i].length < 1) {
        return null;
      } else if (lines[i].includes(searchText)) {
        return lines[i];
      }
    }
    return null;
  }

  isInsideIfBlock(ast, searchText) {
    const lines = ast.split("\n");

    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].includes("[if")) {
        if (lines[i + 1].includes(searchText) && lines[i + 1].includes("\t")) {
          return true;
        }
      }
    }

    return false;
  }

  findIfExpressionByCondition(ast, searchString) {
    const lines = ast.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].includes("[if") && lines[i].includes(searchString)) {
        const nextLine = lines[i + 1];
        if (nextLine.includes("\t")) {
          return nextLine;
        }
      }
    }
    return null;
  }

  checkIfBlocksOrder(ast) {
    const lines = ast.split("\n");

    let firstIfIndex = -1;
    let secondIfIndex = -1;
    let thirdIfIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].includes("[if") &&
        lines[i].includes("(x_velocity)") &&
        lines[i].includes("(15)")
      ) {
        firstIfIndex = i;
      } else if (
        lines[i].includes("[if") &&
        lines[i].includes("(x_position)") &&
        lines[i].includes("(7.5)")
      ) {
        secondIfIndex = i;
      } else if (
        (lines[i].includes("[if") &&
          lines[i].includes("(x_velocity)") &&
          lines[i].includes("(0)")) ||
        (lines[i].includes("[if") &&
          lines[i].includes("Stop") &&
          lines[i].includes("(x_position)"))
      ) {
        thirdIfIndex = i;
      }
    }
    if (firstIfIndex !== -1 && secondIfIndex !== -1 && thirdIfIndex !== -1) {
      return firstIfIndex < secondIfIndex && secondIfIndex < thirdIfIndex;
    } else {
      return false;
    }
  }

  // updateScore(time, ast) {
  updateScore(ast) {
    // this.scoringRubricListedObj.timestamp.push(time);
    let scoringRubric = this.store.getters.getScore;
    // let droneScoringRubric = this.store.getters.getDroneScore;
    Object.keys(scoringRubric).forEach((key) => {
      switch (key) {
        case "positionInitialization": {
          let block = this.getMatchingBlock(ast, "set x_position to");
          let value;
          let parent = this.getRootBlock(ast, "set x_position to");
          if (block && parent === "greenflag clicked") {
            // console.log(block[0]);
            value = block[0].split("(")[1].split(")")[0];
            if (value === "-60") {
              scoringRubric.positionInitialization = 1;
              this.scoringRubricListedObj.positionInitialization.push(1);
            } else {
              this.scoringRubricListedObj.positionInitialization.push(0);
              scoringRubric.positionInitialization = 0;
            }
          } else {
            scoringRubric.positionInitialization = 0;
            this.scoringRubricListedObj.positionInitialization.push(0);
          }
          break;
        }
        case "velocityInitialization": {
          let block = this.getMatchingBlock(ast, "set x_velocity to");
          let value;
          let parent = this.getRootBlock(ast, "set x_velocity to");
          if (block && parent === "greenflag clicked") {
            value = block[0].split("(")[1].split(")")[0];
            if (value === "0") {
              scoringRubric.velocityInitialization = 1;
              this.scoringRubricListedObj.velocityInitialization.push(1);
            } else {
              scoringRubric.velocityInitialization = 0;
              this.scoringRubricListedObj.velocityInitialization.push(0);
            }
          } else {
            this.scoringRubricListedObj.velocityInitialization.push(0);
            scoringRubric.velocityInitialization = 0;
          }
          break;
        }
        case "accelerationInitialization": {
          let block = this.getMatchingBlock(ast, "set x_acceleration to");
          let value;
          let parent = this.getRootBlock(ast, "set x_acceleration to");
          if (block && parent === "greenflag clicked") {
            value = block[0].split("(")[1].split(")")[0];
            if (["3", "4"].includes(value)) {
              scoringRubric.accelerationInitialization = 1;
              this.scoringRubricListedObj.accelerationInitialization.push(1);
            } else {
              scoringRubric.accelerationInitialization = 0;
              this.scoringRubricListedObj.accelerationInitialization.push(0);
            }
          } else {
            scoringRubric.accelerationInitialization = 0;
            this.scoringRubricListedObj.accelerationInitialization.push(0);
          }
          break;
        }
        case "deltaTInitialization": {
          let block = this.getMatchingBlock(ast, "set DeltaT to");
          let value;
          let parent = this.getRootBlock(ast, "set DeltaT to");
          if (block && parent === "greenflag clicked") {
            value = block[0].split("(")[1].split(")")[0];
            if (["0", "0.1"].includes(value)) {
              scoringRubric.deltaTInitialization = 1;
              this.scoringRubricListedObj.deltaTInitialization.push(1);
            } else {
              scoringRubric.deltaTInitialization = 0;
              this.scoringRubricListedObj.deltaTInitialization.push(0);
            }
          } else {
            scoringRubric.deltaTInitialization = 0;
            this.scoringRubricListedObj.deltaTInitialization.push(0);
          }
          break;
        }
        case "startSimulation": {
          let block = this.getMatchingBlock(ast, "start simulation");
          let parent = this.getRootBlock(ast, "start simulation");
          if (block && parent === "greenflag clicked") {
            scoringRubric.startSimulation = 1;
            this.scoringRubricListedObj.startSimulation.push(1);
          } else {
            this.scoringRubricListedObj.startSimulation.push(0);
            scoringRubric.startSimulation = 0;
          }
          break;
        }
        case "updatePosition": {
          let block = this.getMatchingBlock(ast, "change x_position by");
          let parent = this.getRootBlock(ast, "change x_position by");
          let ifPosition = this.checkIfBeforeOrAfter(
            ast,
            "change x_position by"
          );
          if (
            block &&
            (block[0] === "[change x_position by (DeltaT) (×) (x_velocity)]" ||
              block[0] ===
                "[change x_position by (x_velocity) (×) (DeltaT)]") &&
            parent === "simulation step" &&
            (ifPosition === "after" || ifPosition === null)
          ) {
            scoringRubric.updatePosition = 1;
            this.scoringRubricListedObj.updatePosition.push(1);
          } else {
            this.scoringRubricListedObj.updatePosition.push(0);
            scoringRubric.updatePosition = 0;
          }
          break;
        }
        case "updateVelocity": {
          let block = this.getMatchingBlock(ast, "change x_velocity by");
          let parent = this.getRootBlock(ast, "change x_velocity by");
          let ifPosition = this.checkIfBeforeOrAfter(
            ast,
            "change x_velocity by"
          );
          if (
            block &&
            (block[0] ===
              "[change x_velocity by (DeltaT) (×) (x_acceleration)]" ||
              block[0] ===
                "[change x_velocity by (x_acceleration) (×) (DeltaT)]") &&
            parent === "simulation step" &&
            (ifPosition === "after" || ifPosition === null)
          ) {
            this.scoringRubricListedObj.updateVelocity.push(1);
            scoringRubric.updateVelocity = 1;
          } else {
            this.scoringRubricListedObj.updateVelocity.push(0);
            scoringRubric.updateVelocity = 0;
          }
          break;
        }
        case "updateOrder": {
          if (
            scoringRubric.updatePosition === 1 &&
            scoringRubric.updateVelocity === 1
          ) {
            if (this.checkChangeOrder(ast) === "before") {
              this.scoringRubricListedObj.updateOrder.push(1);
              scoringRubric.updateOrder = 1;
            } else {
              this.scoringRubricListedObj.updateOrder.push(0);
              scoringRubric.updateOrder = 0;
            }
          } else {
            this.scoringRubricListedObj.updateOrder.push(0);
            scoringRubric.updateOrder = 0;
          }
          break;
        }
        case "accuracy": {
          let block = this.findBlockAfterGreenFlag(
            ast,
            "set x_acceleration to"
          );
          if (block) {
            if (
              scoringRubric.updatePosition === 1 &&
              scoringRubric.updateVelocity === 1
            ) {
              let value = block.split("(")[1].split(")")[0];
              if (parseInt(value) > 0) {
                this.scoringRubricListedObj.accuracy.push(1);
                scoringRubric.accuracy = 1;
              } else {
                this.scoringRubricListedObj.accuracy.push(0);
                scoringRubric.accuracy = 0;
              }
            } else {
              this.scoringRubricListedObj.accuracy.push(0);
              scoringRubric.accuracy = 0;
            }
          } else {
            this.scoringRubricListedObj.accuracy.push(0);
            scoringRubric.accuracy = 0;
          }
          break;
        }
        case "cruising": {
          let block = this.getMatchingBlock(ast, "\t[set x_acceleration to");
          let value;
          let parent = this.getRootBlock(ast, "\t[set x_acceleration to");
          let ifPosition = this.checkIfBeforeOrAfter(
            ast,
            "	[set x_acceleration to "
          );
          if (block && parent === "simulation step") {
            value = block[0].split("(")[1].split(")")[0];
            if (value === 0) {
              if (ifPosition === "after" || ifPosition === "both") {
                this.scoringRubricListedObj.cruising.push(1);
                scoringRubric.cruising = 1;
              } else {
                this.scoringRubricListedObj.cruising.push(0);
                scoringRubric.cruising = 0;
              }
            } else {
              this.scoringRubricListedObj.cruising.push(0);
              scoringRubric.cruising = 0;
            }
          } else {
            this.scoringRubricListedObj.cruising.push(0);
            scoringRubric.cruising = 0;
          }
          break;
        }
        case "decelerating": {
          let block = this.getMatchingBlock(
            ast,
            "\t[set x_acceleration to (-3)"
          );
          if (!block) {
            block = this.getMatchingBlock(ast, "\t[set x_acceleration to (-4)");
          }
          let parent = this.getRootBlock(ast, block);
          let ifPosition = this.checkIfBeforeOrAfter(
            ast,
            "	[set x_acceleration to "
          );
          if (
            block &&
            parent === "simulation step" &&
            ["after", "both"].includes(ifPosition)
          ) {
            this.scoringRubricListedObj.decelerating.push(1);
            scoringRubric.decelerating = 1;
          } else {
            this.scoringRubricListedObj.decelerating.push(0);
            scoringRubric.decelerating = 0;
          }
          break;
        }
        case "stopping": {
          let block = this.getMatchingBlock(ast, "stop simulation");
          let parent = this.getRootBlock(ast, "stop simulation");
          if (
            block &&
            parent === "simulation step" &&
            this.isInsideIfBlock(ast, "stop simulation")
          ) {
            this.scoringRubricListedObj.stopping.push(1);
            scoringRubric.stopping = 1;
          } else {
            this.scoringRubricListedObj.stopping.push(0);
            scoringRubric.stopping = 0;
          }
          break;
        }
        case "cruisingConditional": {
          let block;
          let parentSearchString;
          if (!this.getMatchingBlock(ast, "[if (x_velocity) (>) (")) {
            if (!this.getMatchingBlock(ast, "(<) (x_velocity)")) {
              this.scoringRubricListedObj.cruisingConditional.push(0);
              scoringRubric.cruisingConditional = 0;
            } else {
              block = this.getMatchingBlock(ast, "(<) (x_velocity)");
              parentSearchString = "(<) (x_velocity)";
            }
          } else {
            block = this.getMatchingBlock(ast, "[if (x_velocity) (>) (");
            parentSearchString = "[if (x_velocity) (>) (";
          }
          let parent = this.getRootBlock(ast, parentSearchString);
          if (block && parent === "simulation step") {
            this.scoringRubricListedObj.cruisingConditional.push(1);
            scoringRubric.cruisingConditional = 1;
          } else {
            this.scoringRubricListedObj.cruisingConditional.push(0);
            scoringRubric.cruisingConditional = 0;
          }
          break;
        }
        case "slowingConditional": {
          let block = this.getMatchingBlock(ast, "[if (x_position) (>) (7.5)");
          let parent = this.getRootBlock(ast, "[if (x_position) (>) (7.5)");
          let ifExpression = this.findIfExpressionByCondition(
            ast,
            "(x_position) (>) (7.5)"
          );
          let setValue;
          if (ifExpression && ifExpression.includes("set x_acceleration")) {
            setValue = ifExpression.split("(")[1].split(")")[0];
          }
          if (block && parent === "simulation step" && setValue === -4) {
            this.scoringRubricListedObj.slowingConditional.push(1);
            scoringRubric.slowingConditional = 1;
          } else {
            this.scoringRubricListedObj.slowingConditional.push(0);
            scoringRubric.slowingConditional = 0;
          }
          break;
        }
        case "stoppingConditional": {
          let parentValue;
          let block = this.getMatchingBlock(ast, "(x_velocity) < (0)");
          let block1 = this.getMatchingBlock(ast, "(0) (>) (x_velocity)");
          let block2 = this.getMatchingBlock(ast, "(x_position) (>) (Stop)");
          let block3 = this.getMatchingBlock(ast, "(Stop) (<) (x_position)");

          if (block) {
            parentValue = "(x_velocity) < (0)";
          } else if (block1) {
            parentValue = "(0) (>) (x_velocity)";
          } else if (block2) {
            parentValue = "(x_position) (>) (Stop)";
          } else if (block3) {
            parentValue = "(Stop) (<) (x_position)";
          }
          let parent = this.getRootBlock(ast, parentValue);
          if (
            (block || block1 || block2 || block3) &&
            parent === "simulation step" &&
            scoringRubric.slowingConditional === 1
          ) {
            this.scoringRubricListedObj.stoppingConditional.push(1);
            scoringRubric.stoppingConditional = 1;
          } else {
            this.scoringRubricListedObj.stoppingConditional.push(0);
            scoringRubric.stoppingConditional = 0;
          }
          break;
        }
        case "completeCruising": {
          let ifExpression = this.findIfExpressionByCondition(
            ast,
            "(x_velocity) (>) (15)"
          );
          let ifExpression1 = this.findIfExpressionByCondition(
            ast,
            "(15) (<) (x_velocity)"
          );
          if (
            ifExpression &&
            scoringRubric.cruising === 1 &&
            scoringRubric.cruisingConditional === 1
          ) {
            if (ifExpression.includes("[set x_acceleration to (0) ]")) {
              this.scoringRubricListedObj.completeCruising.push(1);
              scoringRubric.completeCruising = 1;
            } else {
              this.scoringRubricListedObj.completeCruising.push(0);
              scoringRubric.completeCruising = 0;
            }
          } else if (
            ifExpression1 &&
            scoringRubric.cruising === 1 &&
            scoringRubric.cruisingConditional === 1
          ) {
            if (ifExpression1.includes("[set x_acceleration to (0) ]")) {
              this.scoringRubricListedObj.completeCruising.push(1);
              scoringRubric.completeCruising = 1;
            } else {
              this.scoringRubricListedObj.completeCruising.push(0);
              scoringRubric.completeCruising = 0;
            }
          } else {
            this.scoringRubricListedObj.completeCruising.push(0);
            scoringRubric.completeCruising = 0;
          }
          break;
        }
        case "completeSlowDown": {
          let ifExpression = this.findIfExpressionByCondition(
            ast,
            "(x_velocity) (>) (7.5)"
          );
          let ifExpression1 = this.findIfExpressionByCondition(
            ast,
            "(7.5) (<) (x_velocity)"
          );
          if (
            ifExpression &&
            scoringRubric.decelerating === 1 &&
            scoringRubric.slowingConditional === 1
          ) {
            if (
              ifExpression.includes("[set x_acceleration to (-4) ]") ||
              ifExpression.includes("[set x_acceleration to (-3) ]")
            ) {
              this.scoringRubricListedObj.completeSlowDown.push(1);
              scoringRubric.completeSlowDown = 1;
            } else {
              this.scoringRubricListedObj.completeSlowDown.push(0);
              scoringRubric.completeSlowDown = 0;
            }
          } else if (
            ifExpression1 &&
            scoringRubric.decelerating === 1 &&
            scoringRubric.slowingConditional === 1
          ) {
            if (
              ifExpression1.includes("[set x_acceleration to (-4) ]") ||
              ifExpression1.includes("[set x_acceleration to (-3) ]")
            ) {
              this.scoringRubricListedObj.completeSlowDown.push(1);
              scoringRubric.completeSlowDown = 1;
            } else {
              this.scoringRubricListedObj.completeSlowDown.push(0);
              scoringRubric.completeSlowDown = 0;
            }
          } else {
            this.scoringRubricListedObj.completeSlowDown.push(0);
            scoringRubric.completeSlowDown = 0;
          }
          break;
        }
        case "completeStopping": {
          let ifExpression = this.findIfExpressionByCondition(
            ast,
            "(x_velocity) < (0)"
          );
          let ifExpression1 = this.findIfExpressionByCondition(
            ast,
            "(0) (>) (x_velocity)"
          );
          let ifExpression2 = this.findIfExpressionByCondition(
            ast,
            "(x_position) (>) (Stop)"
          );
          let ifExpression3 = this.findIfExpressionByCondition(
            ast,
            "(Stop) (<) (x_position)"
          );
          let expression;
          if (ifExpression && ifExpression.includes("stop simulation")) {
            expression = ifExpression;
          } else if (
            ifExpression1 &&
            ifExpression1.includes("stop simulation")
          ) {
            expression = ifExpression1;
          } else if (
            ifExpression2 &&
            ifExpression2.includes("stop simulation")
          ) {
            expression = ifExpression2;
          } else if (
            ifExpression3 &&
            ifExpression3.includes("stop simulation")
          ) {
            expression = ifExpression3;
          } else {
            expression = null;
          }
          if (
            expression &&
            scoringRubric.stopping === 1 &&
            scoringRubric.stoppingConditional === 1
          ) {
            this.scoringRubricListedObj.completeStopping.push(1);
            scoringRubric.completeStopping = 1;
          } else {
            this.scoringRubricListedObj.completeStopping.push(0);
            scoringRubric.completeStopping = 0;
          }
          break;
        }
        case "completeOrdering": {
          if (this.checkIfBlocksOrder(ast)) {
            this.scoringRubricListedObj.completeOrdering.push(1);
            scoringRubric.completeOrdering = 1;
          } else {
            this.scoringRubricListedObj.completeOrdering.push(0);
            scoringRubric.completeOrdering = 0;
          }
          break;
        }
      }
    });

    this.store.dispatch("updateScore", scoringRubric);
  }
  getFinalScore() {
    return this.scoringRubricListedObj;
  }
}
