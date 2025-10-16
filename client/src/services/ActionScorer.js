export default class ActionScorer {
  constructor(blocksName, treeRootsName, actionListName, store) {
    this.blocksName = blocksName;
    this.treeRootsName = treeRootsName;
    this.actionListName = actionListName;
    this.store = store;
  }

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
      if (singleSection.includes("[when green flag clicked]")) {
        greenFlagSection = singleSection;
      } else if (singleSection.includes("[simulation step]")) {
        simulationStepSection = singleSection;
      }
    } else {
      sections.forEach((section) => {
        if (section.includes("[when green flag clicked]")) {
          greenFlagSection = section;
        } else if (section.includes("[simulation step]")) {
          simulationStepSection = section;
        }
      });
    }

    let result;

    if (greenFlagSection && greenFlagSection.includes(searchString)) {
      result = "green flag clicked";
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
      if (lines[i].includes("if")) {
        beforeIfIndex = i;
        break;
      }
    }

    // Check after the search text for an "if" statement
    for (let i = searchIndex + 1; i < lines.length; i++) {
      if (lines[i].includes("if")) {
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
      if (lines[i].includes("change x_velocity by") && velocityIndex === -1) {
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
      if (lines[i].includes("[when green flag clicked]")) {
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

    for (let i = 0; i < lines.length; i++) {
      // Found an if statement
      if (lines[i].includes("if")) {
        // Check all following lines until we find a non-indented line or end of file
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j];

          // Empty line, skip
          if (line.trim() === "") {
            break; // End of this if block's body
          }

          // If line starts with tab, it's inside the if block body
          if (line.startsWith("\t")) {
            if (line.includes(searchText)) {
              return true;
            }
          } else {
            // Non-indented line means we've exited the if block
            break;
          }
        }
      }
    }

    return false;
  }

  findIfExpressionByCondition(ast, searchString) {
    const lines = ast.split("\n");
    let result = "";
    let j = 1;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].includes("if") && lines[i].includes(searchString)) {
        let nextLine = lines[i + j];
        if (nextLine.includes("\t")) {
          while (nextLine.includes("\t")) {
            result += nextLine;
            j += 1;
            nextLine = lines[i + j];
          }
          return result;
        }
        j += 1;
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
        lines[i].includes("if") &&
        lines[i].includes("(x_velocity)") &&
        lines[i].includes("(SpeedLimit)")
      ) {
        firstIfIndex = i;
      } else if (
        lines[i].includes("if") &&
        lines[i].includes("(x_position)") &&
        lines[i].includes("(StopSignPosition)") &&
        lines[i].includes("(−)")
      ) {
        secondIfIndex = i;
      } else if (
        (lines[i].includes("if") &&
          lines[i].includes("(x_velocity)") &&
          lines[i].includes("(0)")) ||
        (lines[i].includes("if") &&
          lines[i].includes("StopSignPosition") &&
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

  updateScore(ast) {
    let scoringRubric = this.store.getters.getScore;
    Object.keys(scoringRubric).forEach((key) => {
      switch (key) {
        case "initialize_position": {
          let block = this.getMatchingBlock(ast, "set x_position to");
          let value;
          let parent = this.getRootBlock(ast, "set x_position to");
          if (block && parent === "green flag clicked") {
            value = block[0].split("(")[1].split(")")[0];
            if (value === "-60") {
              scoringRubric.initialize_position = 1;
            } else {
              scoringRubric.initialize_position = 0;
            }
          } else {
            scoringRubric.initialize_position = 0;
          }
          break;
        }
        case "initialize_velocity": {
          let block = this.getMatchingBlock(ast, "set x_velocity to");
          let value;
          let parent = this.getRootBlock(ast, "set x_velocity to");
          if (block && parent === "green flag clicked") {
            value = block[0].split("(")[1].split(")")[0];
            if (value === "0") {
              scoringRubric.initialize_velocity = 1;
            } else {
              scoringRubric.initialize_velocity = 0;
            }
          } else {
            scoringRubric.initialize_velocity = 0;
          }
          break;
        }
        case "initialize_acceleration": {
          let block = this.getMatchingBlock(ast, "set x_acceleration to");
          let value;
          let parent = this.getRootBlock(ast, "set x_acceleration to");
          if (block && parent === "green flag clicked") {
            value = block[0].split("(")[1].split(")")[0];
            if (["3", "4"].includes(value)) {
              scoringRubric.initialize_acceleration = 1;
            } else {
              scoringRubric.initialize_acceleration = 0;
            }
          } else {
            scoringRubric.initialize_acceleration = 0;
          }
          break;
        }
        case "initialize_deltaT": {
          let block = this.getMatchingBlock(ast, "set DeltaT to");
          let value;
          let parent = this.getRootBlock(ast, "set DeltaT to");
          if (block && parent === "green flag clicked") {
            value = block[0].split("(")[1].split(")")[0];
            if (["0", "0.1"].includes(value)) {
              scoringRubric.initialize_deltaT = 1;
            } else {
              scoringRubric.initialize_deltaT = 0;
            }
          } else {
            scoringRubric.initialize_deltaT = 0;
          }
          break;
        }
        case "set_speed_limit": {
          let block = this.getMatchingBlock(ast, "SpeedLimit");
          let value;
          let parent = this.getRootBlock(ast, "SpeedLimit");
          if (block && parent === "green flag clicked") {
            value = block[0].split("(")[2].split(")")[0];
            if (value === "15") {
              scoringRubric.set_speed_limit = 1;
            } else {
              scoringRubric.set_speed_limit = 0;
            }
          } else {
            scoringRubric.set_speed_limit = 0;
          }
          break;
        }
        case "start_simulation": {
          let block = this.getMatchingBlock(ast, "start simulation");
          let parent = this.getRootBlock(ast, "start simulation");
          if (block && parent === "green flag clicked") {
            scoringRubric.start_simulation = 1;
          } else {
            scoringRubric.start_simulation = 0;
          }
          break;
        }
        case "accurate_comparison_position_velocity_time": {
          let block = this.getMatchingBlock(ast, "change x_position by");
          let parent = this.getRootBlock(ast, "change x_position by");
          let ifPosition = this.checkIfBeforeOrAfter(
            ast,
            "change x_position by"
          );
          if (
            block &&
            (block[0] ===
              "[change x_position by ((DeltaT) (×) (x_velocity))]" ||
              block[0] ===
                "[change x_position by ((x_velocity) (×) (DeltaT))]") &&
            parent === "simulation step" &&
            (ifPosition === "after" || ifPosition === null)
          ) {
            scoringRubric.accurate_comparison_position_velocity_time = 1;
          } else {
            scoringRubric.accurate_comparison_position_velocity_time = 0;
          }
          break;
        }
        case "accurate_comparison_velocity_acceleration_time": {
          let block = this.getMatchingBlock(ast, "change x_velocity by");
          let parent = this.getRootBlock(ast, "change x_velocity by");
          let ifPosition = this.checkIfBeforeOrAfter(
            ast,
            "change x_velocity by"
          );
          if (
            block &&
            (block[0] ===
              "[change x_velocity by ((DeltaT) (×) (x_acceleration))]" ||
              block[0] ===
                "[change x_velocity by ((x_acceleration) (×) (DeltaT))]") &&
            parent === "simulation step" &&
            (ifPosition === "after" || ifPosition === null)
          ) {
            scoringRubric.accurate_comparison_velocity_acceleration_time = 1;
          } else {
            scoringRubric.accurate_comparison_velocity_acceleration_time = 0;
          }
          break;
        }
        case "update_order_of_velocity_position": {
          if (
            scoringRubric.accurate_comparison_position_velocity_time === 1 &&
            scoringRubric.accurate_comparison_velocity_acceleration_time === 1
          ) {
            if (this.checkChangeOrder(ast) === "before") {
              scoringRubric.update_order_of_velocity_position = 1;
            } else {
              scoringRubric.update_order_of_velocity_position = 0;
            }
          } else {
            scoringRubric.update_order_of_velocity_position = 0;
          }
          break;
        }
        case "code_accuracy_to_accelerate_truck": {
          let block = this.findBlockAfterGreenFlag(
            ast,
            "set x_acceleration to"
          );
          if (block) {
            if (
              scoringRubric.accurate_comparison_position_velocity_time === 1 &&
              scoringRubric.accurate_comparison_velocity_acceleration_time === 1
            ) {
              let value = block.split("(")[1].split(")")[0];
              if (parseInt(value) > 0) {
                scoringRubric.code_accuracy_to_accelerate_truck = 1;
              } else {
                scoringRubric.code_accuracy_to_accelerate_truck = 0;
              }
            } else {
              scoringRubric.code_accuracy_to_accelerate_truck = 0;
            }
          } else {
            scoringRubric.code_accuracy_to_accelerate_truck = 0;
          }
          break;
        }
        case "setting_acceleration_to_cruise_truck": {
          let block = this.getMatchingBlock(ast, "\t[set x_acceleration to");
          let value;
          let parent = this.getRootBlock(ast, "\t[set x_acceleration to");
          let ifPosition = this.checkIfBeforeOrAfter(
            ast,
            "	[set x_acceleration to "
          );
          if (block && parent === "simulation step") {
            value = block[0].split("(")[1].split(")")[0];
            if (value === "0") {
              if (ifPosition === "after" || ifPosition === "both") {
                scoringRubric.setting_acceleration_to_cruise_truck = 1;
              } else {
                scoringRubric.setting_acceleration_to_cruise_truck = 0;
              }
            } else {
              scoringRubric.setting_acceleration_to_cruise_truck = 0;
            }
          } else {
            scoringRubric.setting_acceleration_to_cruise_truck = 0;
          }
          break;
        }
        case "setting_acceleration_to_decelerate_truck": {
          let block = this.getMatchingBlock(
            ast,
            "\t[set x_acceleration to (-3)"
          );
          if (block.length < 1) {
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
            ["before", "both"].includes(ifPosition)
          ) {
            scoringRubric.setting_acceleration_to_decelerate_truck = 1;
          } else {
            scoringRubric.setting_acceleration_to_decelerate_truck = 0;
          }
          break;
        }
        case "stop_simulation": {
          let block = this.getMatchingBlock(ast, "stop simulation");
          let parent = this.getRootBlock(ast, "stop simulation");
          if (
            block &&
            parent === "simulation step" &&
            this.isInsideIfBlock(ast, "stop simulation")
          ) {
            scoringRubric.stop_simulation = 1;
          } else {
            scoringRubric.stop_simulation = 0;
          }
          break;
        }
        case "code_accuracy_to_cruise_truck": {
          let block;
          let parentSearchString;
          if (!this.getMatchingBlock(ast, "if ((x_velocity) (>) (")) {
            if (!this.getMatchingBlock(ast, "(<) (x_velocity)")) {
              scoringRubric.code_accuracy_to_cruise_truck = 0;
            } else {
              block = this.getMatchingBlock(ast, "(<) (x_velocity)");
              parentSearchString = "(<) (x_velocity)";
            }
          } else {
            block = this.getMatchingBlock(ast, "if ((x_velocity) (>) (");
            parentSearchString = "if ((x_velocity) (>) (";
          }
          let parent = this.getRootBlock(ast, parentSearchString);
          if (block && parent === "simulation step") {
            scoringRubric.code_accuracy_to_cruise_truck = 1;
          } else {
            scoringRubric.code_accuracy_to_cruise_truck = 0;
          }
          break;
        }
        case "code_accuracy_to_slowdown_truck": {
          let block = this.getMatchingBlock(
            ast,
            "if ((x_position) (>) ((StopSignPosition) (−)"
          );
          let parent = this.getRootBlock(
            ast,
            "if ((x_position) (>) ((StopSignPosition) (−)"
          );
          let ifExpression = this.findIfExpressionByCondition(
            ast,
            "if ((x_position) (>) ((StopSignPosition) (−)"
          );
          let lookAheadValue;
          if (block.length > 0) {
            lookAheadValue = block[0].split("(−) (")[1]?.split(")")[0];
          }
          let setValue;
          if (ifExpression && ifExpression.includes("set x_acceleration")) {
            setValue = ifExpression.split("(")[1].split(")")[0];
          }
          if (block && parent === "simulation step") {
            if (
              lookAheadValue >= "35" &&
              lookAheadValue <= "40" &&
              setValue === "-3"
            ) {
              scoringRubric.code_accuracy_to_slowdown_truck = 1;
            } else if (
              lookAheadValue >= "25.625" &&
              lookAheadValue <= "30.625" &&
              setValue === "-4"
            ) {
              scoringRubric.code_accuracy_to_slowdown_truck = 1;
            } else {
              scoringRubric.code_accuracy_to_slowdown_truck = 0;
            }
          } else {
            scoringRubric.code_accuracy_to_slowdown_truck = 0;
          }
          break;
        }
        case "code_accuracy_to_stop_truck": {
          let parentValue;
          let searchStrings = [
            "((x_position) (>) (StopSignPosition)) (and) ((x_velocity) (<) (0))",
            "((x_position) (>) (StopSignPosition)) (and) ((0) (>) (x_velocity))",
            "((StopSignPosition) (<) (x_position)) (and) ((0) (>) (x_velocity))",
            "((StopSignPosition) (<) (x_position)) (and) ((x_velocity) (<) (0))",
            "((x_velocity) (<) (0)) (and) ((x_position) (>) (StopSignPosition))",
            "((x_velocity) (<) (0)) (and) ((StopSignPosition) (<) (x_position))",
            "((0) (>) (x_velocity)) (and) ((x_position) (>) (StopSignPosition))",
            "((0) (>) (x_velocity)) (and) ((StopSignPosition) (<) (x_position))",
          ];
          for (const searchString of searchStrings) {
            let block = this.getMatchingBlock(ast, searchString);
            if (block && block.length > 0) {
              parentValue = searchString;
              break;
            }
          }
          let parent = this.getRootBlock(ast, parentValue);
          if (
            parentValue &&
            parent === "simulation step" &&
            scoringRubric.code_accuracy_to_slowdown_truck === 1
          ) {
            scoringRubric.code_accuracy_to_stop_truck = 1;
          } else {
            scoringRubric.code_accuracy_to_stop_truck = 0;
          }
          break;
        }
        case "accurate_acceleration_velocity_for_cruising": {
          let ifExpression = this.findIfExpressionByCondition(
            ast,
            "(x_velocity) (>) (SpeedLimit)"
          );
          let ifExpression1 = this.findIfExpressionByCondition(
            ast,
            "(SpeedLimit) (<) (x_velocity)"
          );
          if (
            ifExpression &&
            scoringRubric.setting_acceleration_to_cruise_truck === 1 &&
            scoringRubric.code_accuracy_to_cruise_truck === 1
          ) {
            if (ifExpression.includes("[set x_acceleration to (0)]")) {
              scoringRubric.accurate_acceleration_velocity_for_cruising = 1;
            } else {
              scoringRubric.accurate_acceleration_velocity_for_cruising = 0;
            }
          } else if (
            ifExpression1 &&
            scoringRubric.setting_acceleration_to_cruise_truck === 1 &&
            scoringRubric.code_accuracy_to_cruise_truck === 1
          ) {
            if (ifExpression1.includes("[set x_acceleration to (0)]")) {
              scoringRubric.accurate_acceleration_velocity_for_cruising = 1;
            } else {
              scoringRubric.accurate_acceleration_velocity_for_cruising = 0;
            }
          } else {
            scoringRubric.accurate_acceleration_velocity_for_cruising = 0;
          }
          break;
        }
        case "accurate_acceleration_position_for_slowing": {
          let ifExpression = this.findIfExpressionByCondition(
            ast,
            "((x_position) (>) ((StopSignPosition) (−)"
          );
          let ifExpression1 = this.findIfExpressionByCondition(
            ast,
            "(7.5) (<) (x_position)"
          );
          if (
            ifExpression &&
            scoringRubric.setting_acceleration_to_decelerate_truck === 1 &&
            scoringRubric.code_accuracy_to_slowdown_truck === 1
          ) {
            if (
              ifExpression.includes("[set x_acceleration to (-4)]") ||
              ifExpression.includes("[set x_acceleration to (-3)]")
            ) {
              scoringRubric.accurate_acceleration_position_for_slowing = 1;
            } else {
              scoringRubric.accurate_acceleration_position_for_slowing = 0;
            }
          } else if (
            ifExpression1 &&
            scoringRubric.setting_acceleration_to_decelerate_truck === 1 &&
            scoringRubric.code_accuracy_to_slowdown_truck === 1
          ) {
            if (
              ifExpression1.includes("[set x_acceleration to (-4)]") ||
              ifExpression1.includes("[set x_acceleration to (-3)]")
            ) {
              scoringRubric.accurate_acceleration_position_for_slowing = 1;
            } else {
              scoringRubric.accurate_acceleration_position_for_slowing = 0;
            }
          } else {
            scoringRubric.accurate_acceleration_position_for_slowing = 0;
          }
          break;
        }
        case "accurate_code_for_stopping": {
          let expression = null;
          let searchStrings = [
            "((x_position) (>) (StopSignPosition)) (and) ((x_velocity) (<) (0))",
            "((x_position) (>) (StopSignPosition)) (and) ((0) (>) (x_velocity))",
            "((StopSignPosition) (<) (x_position)) (and) ((0) (>) (x_velocity))",
            "((StopSignPosition) (<) (x_position)) (and) ((x_velocity) (<) (0))",
            "((x_velocity) (<) (0)) (and) ((x_position) (>) (StopSignPosition))",
            "((x_velocity) (<) (0)) (and) ((StopSignPosition) (<) (x_position))",
            "((0) (>) (x_velocity)) (and) ((x_position) (>) (StopSignPosition))",
            "((0) (>) (x_velocity)) (and) ((StopSignPosition) (<) (x_position))",
          ];
          for (const searchString of searchStrings) {
            let ifExpression = this.findIfExpressionByCondition(
              ast,
              searchString
            );
            if (ifExpression && ifExpression.includes("stop simulation")) {
              expression = ifExpression;
              break;
            }
          }
          if (
            expression &&
            scoringRubric.stop_simulation === 1 &&
            scoringRubric.code_accuracy_to_stop_truck === 1
          ) {
            scoringRubric.accurate_code_for_stopping = 1;
          } else {
            scoringRubric.accurate_code_for_stopping = 0;
          }
          break;
        }
        case "accurate_order_cruising_slowing_stopping": {
          if (this.checkIfBlocksOrder(ast)) {
            scoringRubric.accurate_order_cruising_slowing_stopping = 1;
          } else {
            scoringRubric.accurate_order_cruising_slowing_stopping = 0;
          }
          break;
        }
        case "physics_mastery": {
          let physicsTotal =
            scoringRubric.initialize_position +
            scoringRubric.initialize_velocity +
            scoringRubric.initialize_acceleration +
            scoringRubric.accurate_comparison_velocity_acceleration_time +
            scoringRubric.accurate_comparison_position_velocity_time +
            scoringRubric.code_accuracy_to_accelerate_truck +
            scoringRubric.setting_acceleration_to_cruise_truck +
            scoringRubric.setting_acceleration_to_decelerate_truck +
            scoringRubric.code_accuracy_to_cruise_truck +
            scoringRubric.code_accuracy_to_slowdown_truck +
            scoringRubric.code_accuracy_to_stop_truck;
          scoringRubric.physics_mastery = Math.floor((physicsTotal / 11) * 100);
          break;
        }
        case "computing_mastery": {
          let computingTotal =
            scoringRubric.start_simulation +
            scoringRubric.stop_simulation +
            scoringRubric.initialize_deltaT +
            scoringRubric.update_order_of_velocity_position +
            scoringRubric.accurate_acceleration_velocity_for_cruising +
            scoringRubric.accurate_acceleration_position_for_slowing +
            scoringRubric.accurate_code_for_stopping +
            scoringRubric.accurate_order_cruising_slowing_stopping +
            scoringRubric.set_speed_limit;
          scoringRubric.computing_mastery = Math.floor(
            (computingTotal / 9) * 100
          );
          break;
        }
        case "overall_mastery": {
          let total =
            scoringRubric.initialize_position +
            scoringRubric.initialize_velocity +
            scoringRubric.initialize_acceleration +
            scoringRubric.accurate_comparison_velocity_acceleration_time +
            scoringRubric.accurate_comparison_position_velocity_time +
            scoringRubric.code_accuracy_to_accelerate_truck +
            scoringRubric.setting_acceleration_to_cruise_truck +
            scoringRubric.setting_acceleration_to_decelerate_truck +
            scoringRubric.code_accuracy_to_cruise_truck +
            scoringRubric.code_accuracy_to_slowdown_truck +
            scoringRubric.code_accuracy_to_stop_truck +
            scoringRubric.start_simulation +
            scoringRubric.stop_simulation +
            scoringRubric.initialize_deltaT +
            scoringRubric.update_order_of_velocity_position +
            scoringRubric.accurate_acceleration_velocity_for_cruising +
            scoringRubric.accurate_acceleration_position_for_slowing +
            scoringRubric.accurate_code_for_stopping +
            scoringRubric.accurate_order_cruising_slowing_stopping +
            scoringRubric.set_speed_limit;
          scoringRubric.overall_mastery = Math.floor((total / 20) * 100);
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
