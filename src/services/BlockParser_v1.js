import MapBlocks from "@/services/MapBlocks";

export default {
  generate(store) {
    const treeRoots = store.getters.getTreeRoots;
    let finalString = "";

    // List of blocks that have operands
    const operatorBlocks = [
      "if %b %c",
      "if %b %c else %c",
      "forever %c",
      "repeat %n %c",
      "repeat until %b %c",
      "%n + %n",
      "%n \u2212 %n", // minus sign from MapBlocks
      "%n \u00D7 %n", // multiply sign from MapBlocks
      "%n / %n",
      "%n mod %n",
      "%n power %n",
      "%s < %s",
      "%s = %s",
      "%s > %s",
      "%b and %b",
      "%b or %b",
      "not %b",
      "%phy of %spr", // Add this block
      "set %var to %s", // Add doSetVar
      "change %var by %n", // Add doChangeVar
      "set DeltaT to %n", // Add setDeltaTime
      // Physics/Motion blocks
      "set x_position to %n",
      "set y_position to %n",
      "change x_position by %n",
      "change y_position by %n",
      "set x_velocity to %n",
      "set y_velocity to %n",
      "change x_velocity by %n",
      "change y_velocity by %n",
      "set mass to %n kg",
      "set x_acceleration to %n",
      "set y_acceleration to %n",
      "set x net force to %n N",
      "set y net force to %n N",
      "change x net force by %n N",
      "change y net force by %n N",
      "set heading to %n deg",
      "change heading by %n deg",
      "set angular velocity to %n deg/s",
      "change angular velocity by %n deg/s",
      // Motion blocks
      "move %n steps",
      "turn %clockwise %n degrees",
      "turn %counterclockwise %n degrees",
      "go to x: %n y: %n",
      "glide %n secs to x: %n y: %n",
      "change x by %n",
      "set x to %n",
      "change y by %n",
      "set y to %n",
    ];

    function decorate(text) {
      return "[" + text + "]";
    }

    function processNode(node) {
      if (!node || !node.name) {
        return "no value";
      }

      // Get the block template from MapBlocks
      let blockTemplate = MapBlocks.get(node.name);
      if (!blockTemplate) {
        blockTemplate = node.name;
      }

      // If this block doesn't have operands, return it as-is (but clean up any placeholders)
      if (!operatorBlocks.includes(blockTemplate)) {
        // Handle special symbolic placeholders that don't need values
        let result = blockTemplate;
        result = result.replace(/%greenflag/g, "green flag");
        result = result.replace(/%keyHat/g, "key");
        result = result.replace(/%msgHat/g, "message");
        result = result.replace(/%msg/g, "message");
        result = result.replace(/%clockwise/g, "clockwise");
        result = result.replace(/%counterclockwise/g, "counterclockwise");

        // Handle simulation_step specifically
        if (result === "simulation_step") {
          result = "simulation step";
        }

        // Clean up any remaining placeholders for non-operator blocks
        result = result.replace(/%\w+/g, "(no value)");
        return result;
      }

      // Get operands from the contained array
      let operands = [];
      if (node.next && node.next.contained) {
        for (let contained of node.next.contained) {
          if (contained) {
            if (contained.id) {
              // This is a nested block - process it recursively
              operands.push(processNode(contained));
            } else {
              // This is a simple value - use exactly what's in the input
              let value = contained.name;
              if (value === "" || value === undefined || value === null) {
                value = "no value";
              }
              operands.push(value);
            }
          } else {
            operands.push("no value");
          }
        }
      }

      // Build the result based on the block type
      return buildExpression(blockTemplate, operands);
    }

    function buildExpression(template, operands) {
      // Handle special control blocks
      if (template === "if %b %c") {
        let condition = operands[0] || "no value";
        let body = operands[1] || "no value";
        return `if (${condition})\n\t[${body}]`;
      }

      if (template === "if %b %c else %c") {
        let condition = operands[0] || "no value";
        let thenBody = operands[1] || "no value";
        let elseBody = operands[2] || "no value";
        return `if (${condition})\n\t[${thenBody}]\nelse\n\t[${elseBody}]`;
      }

      if (template === "forever %c") {
        let body = operands[0] || "no value";
        return `forever\n\t[${body}]`;
      }

      if (template === "repeat %n %c") {
        let times = operands[0] || "no value";
        let body = operands[1] || "no value";
        return `repeat (${times})\n\t[${body}]`;
      }

      if (template === "repeat until %b %c") {
        let condition = operands[0] || "no value";
        let body = operands[1] || "no value";
        return `repeat until (${condition})\n\t[${body}]`;
      }

      // Handle binary operators (two operands)
      const binaryOps = {
        "%n + %n": "+",
        "%n \u2212 %n": "−",
        "%n \u00D7 %n": "×",
        "%n / %n": "/",
        "%n mod %n": "mod",
        "%n power %n": "power",
        "%s < %s": "<",
        "%s = %s": "=",
        "%s > %s": ">",
        "%b and %b": "and",
        "%b or %b": "or",
      };

      if (binaryOps[template]) {
        let left = operands[0] || "no value";
        let right = operands[1] || "no value";
        let operator = binaryOps[template];

        // Wrap complex expressions in extra parentheses
        if (
          left.includes("(") &&
          (left.includes(">") || left.includes("<") || left.includes("−"))
        ) {
          left = `(${left})`;
        } else {
          left = `(${left})`;
        }

        if (
          right.includes("(") &&
          (right.includes(">") || right.includes("<") || right.includes("−"))
        ) {
          right = `(${right})`;
        } else {
          right = `(${right})`;
        }

        return `${left} (${operator}) ${right}`;
      }

      // Handle unary operators
      if (template === "not %b") {
        let operand = operands[0] || "no value";
        return `not (${operand})`;
      }

      // Handle special reporting blocks like "x position of Stop"
      if (template === "%phy of %spr") {
        let property = operands[0] || "no value";
        let sprite = operands[1] || "no value";

        // If sprite is empty or "no value", show full format
        if (sprite === "no value" || sprite === "") {
          return `(${property}) of (no value)`;
        } else {
          // If sprite has a value, show just the sprite value
          if (sprite.includes("Stop")) {
            sprite = "StopSignPosition";
          } else if (sprite.includes("Truck")) {
            sprite = "x_position";
          }
          return sprite;
        }
      }

      // Handle variable assignment blocks
      if (template === "set %var to %s") {
        let variable = operands[0] || "no value";
        let value = operands[1] || "0"; // Default value is 0 for set blocks
        return `set (${variable}) to (${value})`;
      }

      if (template === "change %var by %n") {
        let variable = operands[0] || "no value";
        let amount = operands[1] || "1"; // Default value is 1 for change blocks
        return `change (${variable}) by (${amount})`;
      }

      // Handle DeltaTime block specifically
      if (template === "set DeltaT to %n") {
        let value = operands[0] || "no value";
        return `set DeltaT to (${value})`;
      }

      // Fallback: replace placeholders in template
      let result = template;
      let index = 0;
      result = result.replace(/%\w+/g, () => {
        if (index < operands.length) {
          let operand = operands[index++];
          // Handle empty or undefined operands
          if (operand === "" || operand === undefined || operand === null) {
            return "(no value)";
          }
          return `(${operand})`;
        }
        return "(no value)";
      });

      return result;
    }

    // Process each tree root
    for (let root of treeRoots) {
      // Add connection status
      if (root.name !== "receiveGo" && root.name !== "doSimulationStep") {
        finalString += decorate("Not Connected") + "\n";
      }

      // Process the root block
      let result = processNode(root);

      // Format the result
      if (result.includes("if") && result.includes("\n")) {
        finalString += result + "\n";
      } else {
        finalString += decorate(result) + "\n";
      }

      // Process any following blocks
      let currentNode = root;
      while (currentNode && currentNode.next && currentNode.next.next) {
        currentNode = currentNode.next.next;
        let nextResult = processNode(currentNode);
        if (nextResult.includes("if") && nextResult.includes("\n")) {
          finalString += nextResult + "\n";
        } else {
          finalString += decorate(nextResult) + "\n";
        }
      }

      finalString += "\n";
    }

    return finalString;
  },
};
