import MapBlocks from "@/services/MapBlocks";

export default class BlockParser_v2 {
  /**
   * Constructor to initialize the parser with sprite headers
   * @param {Array<string>} spriteHeaders - Array of sprite names to focus on (e.g., ['DRONE', 'PACKAGE', 'PACKAGE2'])
   */
  constructor(spriteHeaders = []) {
    this.spriteHeaders = spriteHeaders;
    this.spriteSections = {};

    // Initialize each sprite section as an empty string
    spriteHeaders.forEach((header) => {
      this.spriteSections[header] = "";
    });
  }

  /**
   * Generate the final string with sprite headers
   * @param {Object} store - Vuex store
   * @returns {string} - Formatted string with sprite sections
   */
  generate(store) {
    const treeRoots = store.getters.getTreeRoots;
    const sprites = store.getters.getSprites;

    // Reset sprite sections
    this.spriteHeaders.forEach((header) => {
      this.spriteSections[header] = "";
    });

    // Check if we have multiple sprites
    const hasMultipleSprites = Object.keys(sprites).length > 1;

    // List of blocks that have operands
    const operatorBlocks = [
      "if %b %c",
      "if %b %c else %c",
      "forever %c",
      "repeat %n %c",
      "repeat until %b %c",
      "%n + %n",
      "%n − %n", // minus sign from MapBlocks
      "%n × %n", // multiply sign from MapBlocks
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
      "set position to x: %n y: %n",
      "change position by x: %n y: %n",
      "set velocity to x: %n y: %n",
      "change velocity by x: %n y: %n",
      "set acceleration to x: %n y: %n",
      "glide %n secs to x: %n y: %n",
      "change x by %n",
      "set x to %n",
      "change y by %n",
      "set y to %n",
    ];

    const decorate = (text) => {
      return "[" + text + "]";
    };

    // Decorate each line in a multiline string with brackets
    const decorateAllLines = (text) => {
      return text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed === "") return "";
          // Preserve indentation
          const indent = line.match(/^\s*/)[0];
          // Only add brackets if they're not already there
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            return line;
          }
          return indent + decorate(trimmed);
        })
        .join("\n");
    };

    const processNode = (pNode, currentSpriteHeader) => {
      let node = { ...pNode };
      if (!node || !node.name) {
        return "no value";
      }
      if (node.name.includes("_sprite_")) {
        let nodeNameList = node.name.split("_sprite_");
        node.name = nodeNameList[0];
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
              // This is a nested block - process it and any blocks chained after it
              let blockChain = [];
              let currentBlock = contained;
              let visitedBlocks = new Set();

              while (currentBlock && currentBlock.id) {
                // Prevent infinite loops
                if (visitedBlocks.has(currentBlock.id)) {
                  break;
                }
                visitedBlocks.add(currentBlock.id);

                let processedBlock = processNode(
                  currentBlock,
                  currentSpriteHeader
                );
                blockChain.push({
                  block: processedBlock,
                  template:
                    MapBlocks.get(currentBlock.name) || currentBlock.name,
                });

                // Check if there's a next block in the chain
                if (currentBlock.next && currentBlock.next.next) {
                  currentBlock = currentBlock.next.next;
                } else {
                  break;
                }
              }

              // When blocks are used as operands, NEVER decorate them
              // Brackets are ONLY added at the final output stage
              let formattedChain = blockChain
                .map((item) => item.block)
                .join("\n\t");

              operands.push(formattedChain);
            } else {
              // This is a simple value - use exactly what's in the input
              let value = contained.name;
              if (value === "" || value === undefined || value === null) {
                value = "no value";
              }
              if (value === "Speed Limit") {
                value = "SpeedLimit";
              }
              operands.push(value);
            }
          } else {
            operands.push("no value");
          }
        }
      }

      // Build the result based on the block type
      return buildExpression(blockTemplate, operands, currentSpriteHeader);
    };

    const buildExpression = (template, operands, currentSpriteHeader) => {
      // Handle special control blocks
      if (template === "if %b %c") {
        let condition = operands[0] || "no value";
        let body = operands[1] || "no value";
        // Body already has brackets from formatting, don't add more
        return `if (${condition})\n\t${body}`;
      }

      if (template === "if %b %c else %c") {
        let condition = operands[0] || "no value";
        let thenBody = operands[1] || "no value";
        let elseBody = operands[2] || "no value";
        // Bodies already have brackets from formatting, don't add more
        return `if (${condition})\n\t${thenBody}\nelse\n\t${elseBody}`;
      }

      if (template === "forever %c") {
        let body = operands[0] || "no value";
        // Body already has brackets from formatting, don't add more
        return `forever\n\t${body}`;
      }

      if (template === "repeat %n %c") {
        let times =
          operands[0] === "" || operands[0] === "no value"
            ? "0"
            : operands[0] || "0";
        let body = operands[1] || "no value";
        // Body already has brackets from formatting, don't add more
        return `repeat (${times})\n\t${body}`;
      }

      if (template === "repeat until %b %c") {
        let condition = operands[0] || "no value";
        let body = operands[1] || "no value";
        // Body already has brackets from formatting, don't add more
        return `repeat until (${condition})\n\t${body}`;
      }

      // Handle binary operators (two operands)
      const binaryOps = {
        "%n + %n": "+",
        "%n − %n": "−",
        "%n × %n": "×",
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
        // Determine default value based on operator type
        // Numeric operators default to 0, others default to "no value"
        const numericOps = [
          "%n + %n",
          "%n − %n",
          "%n × %n",
          "%n / %n",
          "%n mod %n",
          "%n power %n",
        ];
        const defaultValue = numericOps.includes(template) ? "0" : "no value";

        let left =
          operands[0] === "" || operands[0] === "no value"
            ? defaultValue
            : operands[0] || defaultValue;
        let right =
          operands[1] === "" || operands[1] === "no value"
            ? defaultValue
            : operands[1] || defaultValue;
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

        // Replace spaces with underscores in property name (e.g., "x position" -> "x_position")
        if (property !== "no value") {
          property = property.replace(/ /g, "_");
        }

        // If sprite is empty or "no value", show full format
        if (sprite === "no value" || sprite === "") {
          return `(${property}) of (no value)`;
        } else {
          // If we have multiple sprites, check if sprite matches current header
          if (hasMultipleSprites && currentSpriteHeader) {
            const spriteLower = sprite.toLowerCase();
            const headerLower = currentSpriteHeader.toLowerCase();

            // Check if the sprite matches the current header
            if (spriteLower === headerLower) {
              return property;
            } else {
              // Header and sprite don't match
              return `${property} of ${sprite}`;
            }
          } else {
            // Original behavior for single sprite projects
            if (sprite.includes("Stop")) {
              sprite = "StopSignPosition";
            } else if (sprite.includes("Truck")) {
              sprite = "x_position";
            }
            return sprite;
          }
        }
      }

      // Handle variable assignment blocks
      if (template === "set %var to %s") {
        let variable = operands[0] || "no value";
        let value =
          operands[1] === "" || operands[1] === "no value"
            ? "0"
            : operands[1] || "0";
        return `set (${variable}) to (${value})`;
      }

      if (template === "change %var by %n") {
        let variable = operands[0] || "no value";
        let amount =
          operands[1] === "" || operands[1] === "no value"
            ? "1"
            : operands[1] || "1";
        return `change (${variable}) by (${amount})`;
      }

      // Handle DeltaTime block specifically
      if (template === "set DeltaT to %n") {
        let value =
          operands[0] === "" || operands[0] === "no value"
            ? "0"
            : operands[0] || "0";
        return `set DeltaT to (${value})`;
      }

      // Fallback: replace placeholders in template
      let result = template;
      let index = 0;
      result = result.replace(/%\w+/g, (match) => {
        if (index < operands.length) {
          let operand = operands[index++];
          // Handle empty or undefined operands
          if (
            operand === "" ||
            operand === undefined ||
            operand === null ||
            operand === "no value"
          ) {
            // For numeric placeholders, default to 0 instead of "no value"
            return match === "%n" ? "(0)" : "(no value)";
          }
          return `(${operand})`;
        }
        // For numeric placeholders, default to 0 instead of "no value"
        return match === "%n" ? "(0)" : "(no value)";
      });

      return result;
    };

    // Helper function to get sprite header from ownerId
    const getSpriteHeaderFromOwnerId = (ownerId) => {
      if (!ownerId || !sprites[ownerId]) {
        return null;
      }

      // Get the sprite name from the sprites dictionary using ownerId as key
      const spriteName = sprites[ownerId];
      if (!spriteName) {
        return null;
      }

      // Match the sprite name to a sprite header (case-insensitive)
      const spriteNameLower = spriteName.toLowerCase();
      for (let header of this.spriteHeaders) {
        if (spriteNameLower === header.toLowerCase()) {
          return header;
        }
      }

      return null;
    };

    // Process each tree root and organize by ownerId
    for (let root of treeRoots) {
      // Determine which sprite section this block belongs to
      let spriteHeader = getSpriteHeaderFromOwnerId(root.ownerId);

      // If no matching sprite header found, skip this block
      if (!spriteHeader) {
        console.warn(`No sprite header found for ownerId: ${root.ownerId}`);
        continue;
      }

      let blockText = "";

      // Add connection status
      // if (root.name.includes("receiveGo")) {
      //   if (root.name.includes("_sprite_")) {
      //     let nodeNameList = root.name.split("_sprite_");
      //     blockText += decorate(nodeNameList[1]) + "\n";
      //   }
      // } else if (
      if (root.name !== "receiveGo" && root.name !== "doSimulationStep") {
        blockText += decorate("Not Connected") + "\n";
      }

      // Process the root block
      let result = processNode(root, spriteHeader);

      // Format the result - ALWAYS decorate every line
      blockText += decorateAllLines(result) + "\n";

      // Process any following blocks
      let currentNode = root;
      let visitedNodes = new Set();
      visitedNodes.add(root.id);

      while (currentNode && currentNode.next && currentNode.next.next) {
        currentNode = currentNode.next.next;

        // Prevent infinite loops from circular references
        if (visitedNodes.has(currentNode.id)) {
          console.warn("Circular reference detected in block tree");
          break;
        }
        visitedNodes.add(currentNode.id);

        let nextResult = processNode(currentNode, spriteHeader);
        // ALWAYS decorate every line
        blockText += decorateAllLines(nextResult) + "\n";
      }

      blockText += "\n";

      // Append to the appropriate sprite section
      this.spriteSections[spriteHeader] += blockText;
    }

    // Build final string with sprite headers
    let finalString = "";
    for (let header of this.spriteHeaders) {
      finalString += `[${header}]\n`;
      finalString += this.spriteSections[header];
    }

    return finalString;
  }
}
