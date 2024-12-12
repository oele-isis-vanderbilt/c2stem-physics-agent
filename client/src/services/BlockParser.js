import MapBlocks from "@/services/MapBlocks";

export default {
  generate() {
    const treeRoots = JSON.parse(window.sessionStorage.getItem("treeRoots"));

    let finalString = "";
    let value = "";

    for (let root of treeRoots) {
      parseBlocks(root);
      finalString += "\n";
    }

    function decorate(block) {
      return "[" + block + "]";
    }

    function replaceVariables(block, value) {
      let directional_blocks = ["%clockwise", "%counterclockwise"];
      let AdditionalVariables = false;
      let updatedBlock = "";
      if (block.includes("%")) {
        let blockList = block.split(" ");
        blockList.forEach((element, index) => {
          if (element.includes("%")) {
            if (!AdditionalVariables && !directional_blocks.includes(element)) {
              element = "(" + value + ")";
              AdditionalVariables = true;
            } else if (directional_blocks.includes(element)) {
              element = element.replace("%", "");
            }
            updatedBlock += element + " ";
          } else if (index === blockList.length - 1) {
            updatedBlock += element;
          } else {
            updatedBlock += element + " ";
          }
        });
        return updatedBlock;
      }
    }

    function parseBlocks(node) {
      let rootName = "";
      if (node.id) {
        rootName = MapBlocks.get(node.name);
      }
      if (node.next.contained.length !== 0) {
        for (let nextNode of node.next.contained) {
          if (nextNode) {
            if (!nextNode.id) {
              value = nextNode.name ? nextNode.name : "no value";
              rootName = replaceVariables(rootName, value);
            } else {
              finalString += decorate(rootName);
              parseBlocks(nextNode);
            }
          }
        }
        if (rootName.includes("%c")) {
          rootName = rootName.replaceAll("%c", "(no value)");
        }
        finalString += decorate(rootName) + "\n";
      } else {
        if (rootName.includes("%")) {
          rootName = rootName.replace("%", "");
        }
        finalString += decorate(rootName) + "\n";
      }

      if (node.next.next) {
        parseBlocks(node.next.next);
      }
    }

    return finalString;
  },
};
