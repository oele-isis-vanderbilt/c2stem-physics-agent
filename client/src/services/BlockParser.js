import MapBlocks from "@/services/MapBlocks";

export default {
  generate(store) {
    // Retrieve Tree root objects from the session storage.
    // const treeRoots = JSON.parse(window.sessionStorage.getItem(treeRootsName));
    const treeRoots = store.getters.getTreeRoots;
    /*
     * List of block that require additional handling.
     * The blocks below contain multiple fields that need to handled separately.
     */
    const nested_blocks = [
      "if %b %c",
      "if %b %c else %c",
      "forever %c",
      "repeat %n %c",
      "repeat until %b %c",
      "%n + %n",
      "%n − %n",
      "%n × %n",
      "%n / %n",
      "%n mod %n",
      "%n power %n",
      "%s < %s",
      "%s = %s",
      "%s > %s",
      "%b and %b",
      "%b or %b",
      "not %b",
    ];

    let finalString = ""; // final string with user state.
    let value = "";
    let isNestedBlock = false; // flag to determine if a block has Nested capabilities.

    /*
     * Child elements of a single nested block.
     * ex: (x>y)
     * Here x and y are nested child elements for the nested block "greater than"(>).
     * */
    let nested_children = []; // child elements of a single nested block
    let rootCounter = 0; // counting the number of root blocks being nested.

    /*
     * Nested root blocks of a multiple nested block
     * ex: if((x>y) and (z>a)){
     *         a = b;
     *     }
     * Here 1.x>y, 2.z>a and 3.a=b are nested root children
     * which have nested children of their own.
     * */
    let children = [];
    let nestedChildCounter = 0;
    let rootList = [];
    /*
     * Looping over the multiple tree roots that exist on the NetsBlox canvas.
     * parse the tree roots and generate the user state in text.
     * */
    for (let root of treeRoots) {
      // Initialize or reset variables.
      isNestedBlock = false;
      nested_children = [];
      rootCounter = 0;
      nestedChildCounter = 0;
      rootList = [];
      children = [];
      // parse tree root.
      if (root.name !== "receiveGo" && root.name !== "doSimulationStep") {
        finalString += decorate("Not Connected") + "\n";
      }
      parseBlocks(root);
      finalString += "\n";
    }

    /*
     * Adding brackets to match the syntax required for the agent.
     * Any additional decorations can be added here.
     */
    function decorate(block) {
      return "[" + block + "]";
    }

    /*
     * Apply nested children to the nested blocks.
     * The method replaces the placeholders in the nested block with the items in the nested children list.
     * ex: nestedChildren = ["x", "y"] and the nested block is %n > %v. Result : x > y.
     * */
    function replaceVariables(block, value, contianedIndex) {
      let directional_blocks = ["%clockwise", "%counterclockwise"];
      let AdditionalVariables = false;
      let updatedBlock = "";
      let elementIndex = -1;
      const percentSigns = countPercentSigns(block);
      if (block.includes("%")) {
        let blockList = block.split(" ");
        blockList.forEach((element, index) => {
          if (element.includes("%")) {
            elementIndex++;
            if (percentSigns > 1) {
              if (elementIndex === contianedIndex) {
                if (
                  !AdditionalVariables &&
                  !directional_blocks.includes(element)
                ) {
                  element = "(" + value + ")";
                  AdditionalVariables = true;
                } else if (directional_blocks.includes(element)) {
                  element = element.replace("%", "");
                }
                updatedBlock += element + " ";
              } else {
                updatedBlock += element + " ";
              }
            } else {
              if (
                !AdditionalVariables &&
                !directional_blocks.includes(element)
              ) {
                element = "(" + value + ")";
                AdditionalVariables = true;
              } else if (directional_blocks.includes(element)) {
                element = element.replace("%", "");
              }
              updatedBlock += element + " ";
            }
          } else if (index === blockList.length - 1) {
            updatedBlock += element;
          } else {
            updatedBlock += element + " ";
          }
        });
        return updatedBlock;
      }
    }

    /*
     * Apply nested root block children to the multiple nested block.
     * The method replaces the placeholders in the nested block with the items in the children list.
     * ex: children = ["(x > y) and (d > r)", "(set a = b)"] and the multiple nested block is if %c %n.
     * Result: if (x > y) (and) (d > r)
     *                (set a = b)
     * */
    function AssignNestedChildren(root, children) {
      let rootList = root.split(" ");
      let childCounter = 0;
      let updatedRoot = "";
      rootList.forEach((element) => {
        if (element.includes("%")) {
          if (root.includes("if") && childCounter === 0) {
            element = children[childCounter];
            updatedRoot = decorate(updatedRoot + element.trim()) + "\n";
            childCounter++;
          } else if (root.includes("if") && childCounter === 1) {
            element = "\t" + decorate(children[childCounter]);
            updatedRoot += element;
            childCounter++;
          } else {
            if (children.length > 0) {
              if (typeof children === "string") {
                if (children.includes("(")) {
                  element = children;
                } else {
                  element = "(" + children + ")";
                }
              } else {
                if (children[childCounter].includes("(")) {
                  element = children[childCounter];
                } else {
                  element = "(" + children[childCounter] + ")";
                }
              }
              updatedRoot += element.trim() + " ";
              childCounter++;
            } else {
              updatedRoot += element.trim() + " ";
            }
          }
        } else if (
          ["and", "or", "+", "−", "+", "×", "/", ">"].includes(element)
        ) {
          updatedRoot += "(" + element + ") ";
        } else {
          updatedRoot += element + " ";
        }
      });
      return updatedRoot;
    }

    function countPercentSigns(str) {
      const matches = str.match(/%/g);
      return matches ? matches.length : 0;
    }
    /*
     * Main method to parse the tree elements into the textual user state.
     * The method can be used recursively to process nested nodes.
     * input: tree root node object.
     * output: user state for a single tree root.
     * */
    function parseBlocks(node) {
      try {
        let rootName = "";
        if (node.id) {
          rootName = MapBlocks.get(node.name);
          if (nested_blocks.includes(rootName)) {
            isNestedBlock = true;
            rootCounter++;
            if (nested_children.length > 0) {
              children = [...children, ...nested_children];
              nested_children = [];
            }
          }
        }
        if (node.next.contained.length !== 0) {
          let containedIndex = -1;
          for (let nextNode of node.next.contained) {
            containedIndex += 1;
            if (nextNode) {
              if (!nextNode.id) {
                value = nextNode.name ? nextNode.name : "no value";
                if (rootCounter > 1) {
                  // nested_children.push(value);
                  children.push(value);
                } else {
                  rootName = replaceVariables(rootName, value, containedIndex);
                }
              } else {
                if (!isNestedBlock) {
                  if (!nested_blocks.includes(MapBlocks.get(nextNode.name))) {
                    finalString += decorate(rootName);
                  }
                }
                rootList.push(rootName);
                nestedChildCounter++;
                parseBlocks(nextNode);
              }
            }
          }
          if (
            nested_children.length > 0 &&
            (nested_blocks.includes(rootName) ||
              nested_children[0].includes("no value") ||
              rootName.includes("no value"))
          ) {
            if (
              nested_children.length > 1 &&
              (rootName.includes("no value") || rootName.includes("%n"))
            ) {
              let variableCount =
                rootName.match(new RegExp("%n", "gi"))?.length || 0;
              if (variableCount !== nested_children.length) {
                let splicedChild = nested_children.splice(0, 1);
                children.push(splicedChild[0].trim());
              }
            }
            let updatedRootName;
            let variableCount =
              rootName.match(new RegExp("%", "gi"))?.length || 0;
            if (
              variableCount !== nested_children.length &&
              children.length > 0
            ) {
              if (children[1] === "no value" && rootName === "%phy of %spr") {
                let middleChild = AssignNestedChildren(rootName, children);
                nested_children.push(middleChild);
              } else {
                let splicedChild = children.splice(children.length - 1, 1);
                if (
                  nested_children.length === 1 &&
                  nested_children[0].includes("%")
                ) {
                  let updatedChildren = AssignNestedChildren(
                    nested_children[0],
                    splicedChild[0]
                  );
                  nested_children = [];
                  nested_children.push(updatedChildren);
                } else {
                  if (
                    (rootName.includes(">") || rootName.includes("<")) &&
                    !splicedChild[0].includes("no value")
                  ) {
                    nested_children.push(splicedChild[0].trim());
                  } else {
                    if (rootName === "if %b %c") {
                      nested_children.splice(0, 0, splicedChild[0].trim());
                    } else {
                      nested_children.push(splicedChild[0].trim());
                    }
                  }
                }
              }
            }
            if (
              nested_children.length === 2 &&
              nested_children[1].includes("%")
            ) {
              // if(nested_children[0].includes("(x position) of (Truck)")) {}
              let splicedChild = children.splice(children.length - 1, 1);
              let updatedChildren = AssignNestedChildren(
                nested_children[1],
                nested_children[0]
              );
              nested_children = [];
              if (splicedChild && splicedChild.length > 0) {
                nested_children.push(splicedChild[0].trim());
              }
              nested_children.push(updatedChildren);
            } else if (
              nested_children.length === 2 &&
              nested_children[0].includes("%")
            ) {
              let splicedChild = children.splice(children.length - 1, 1);
              let updatedChildren = AssignNestedChildren(
                nested_children[0],
                nested_children[1]
              );
              nested_children = [];
              nested_children.push(splicedChild[0].trim());
              nested_children.push(updatedChildren);
            }
            if (
              rootName.includes("(x position) of") &&
              nested_children[0].includes("(x position) of")
            ) {
              nested_children.push(rootName);
            } else {
              updatedRootName = AssignNestedChildren(rootName, nested_children);
            }

            if (!rootList.includes("if %b %c")) {
              rootCounter--;
            }
            if (rootCounter === 0) {
              if (updatedRootName.includes("if")) {
                finalString += updatedRootName + "\n";
              } else {
                finalString += decorate(updatedRootName) + "\n";
              }
            } else {
              if (
                updatedRootName.includes("if") &&
                !updatedRootName.includes("%")
              ) {
                finalString += updatedRootName + "\n";
              } else {
                children.push(updatedRootName);
              }
              rootCounter--;
            }
            nested_children = [];
          } else if (rootCounter === 1) {
            if (nested_blocks.includes(rootName)) {
              if (
                rootList.includes("if %b %c") &&
                !rootName.includes("if %b %c")
              ) {
                let updatedChild =
                  AssignNestedChildren(rootName, children) + "\n";
                children = [];
                children.push(updatedChild);
              } else {
                finalString += AssignNestedChildren(rootName, children) + "\n";
                children = [];
              }

              rootCounter--;
              rootList.pop();
            } else if (nested_children.length > 0) {
              if (rootName.includes("%n")) {
                let splicedChild = nested_children.splice(0, 1);
                let newBlock = AssignNestedChildren(rootName, nested_children);
                nested_children = [];
                nested_children.push(splicedChild);
                nested_children.push(newBlock);
              } else if (
                rootName.includes("%s") &&
                nested_children[0].includes("(x position) of")
              ) {
                let newBlock = AssignNestedChildren(rootName, nested_children);
                nested_children = [];
                nested_children.push(newBlock);
              } else {
                nested_children.push(rootName);
              }
            } else if (rootName.includes("no value")) {
              if (rootName.includes("%c")) {
                if (children.length > 0) {
                  rootName = AssignNestedChildren(rootName, children) + "\n";
                  children = [];
                } else {
                  rootName = rootName.replaceAll("%c", "(no value)");
                }
              }
              if (nestedChildCounter > 0 && !rootName.includes("if")) {
                nested_children.push(rootName);
                nestedChildCounter--;
              } else {
                finalString += decorate(rootName) + "\n";
              }
            } else {
              if (
                ["+", "−", "×", "/", "<", ">"].some((operator) =>
                  rootName.includes(operator)
                )
              ) {
                finalString += decorate(rootName) + "\n";
              } else {
                children.push(rootName);
              }
            }
          } else if (rootCounter > 1) {
            if (children.length > 0 && rootName.includes("%")) {
              if (children.length > 2) {
                let splicedChild = children.splice(0, 1);
                nested_children.push(splicedChild[0].trim());
              }
              nested_children.push(
                AssignNestedChildren(rootName, children) + "\n"
              );
              children = [];
            } else if (nested_children.length > 0) {
              nested_children.push(rootName);
            } else {
              children.push(rootName);
            }
            rootList.pop();
            rootCounter--;
          } else {
            if (children.length > 0) {
              if (rootList.includes("if %b %c")) {
                // if(children.length ===1){
                //   children.push(rootName);
                // }else{
                if (rootName.includes("%")) {
                  let transitionalBlock =
                    AssignNestedChildren(rootName, children) + "\n";
                  children = [];
                  rootList.pop();
                  if (transitionalBlock.includes("if")) {
                    finalString += transitionalBlock;
                  } else {
                    children.push(transitionalBlock);
                  }
                } else {
                  children.push(rootName);
                }

                // }
              } else {
                finalString += AssignNestedChildren(rootName, children) + "\n";
                children = [];
              }
            } else {
              if (rootName.includes("if")) {
                finalString += rootName + "\n";
              } else {
                if (rootName.includes("%n")) {
                  let finalList = finalString.split("\n");
                  let lastELement = finalList[finalList.length - 2]
                    .replace("[", "")
                    .replace("]", "")
                    .trim();
                  let completedBlock =
                    AssignNestedChildren(rootName, [lastELement]) + "\n";
                  finalString = "";
                  for (let i = 0; i < finalList.length - 1; i++) {
                    if (i === finalList.length - 2) {
                      finalString += decorate(completedBlock.trim()) + "\n";
                    } else if (!finalList[i].includes("\n")) {
                      finalString += finalList[i] + "\n";
                    }
                  }
                } else {
                  finalString += decorate(rootName.trim()) + "\n";
                }
              }
            }
          }
        } else {
          if (rootName.includes("%")) {
            rootName = rootName.replace("%", "");
          }
          if (isNestedBlock) {
            nested_children.push(rootName);
          } else {
            if (rootName.includes("if")) {
              finalString += rootName + "\n";
            } else {
              finalString += decorate(rootName) + "\n";
            }
          }
          // here is where the last blocks are printed.
        }

        if (node.next.next) {
          parseBlocks(node.next.next);
        }
      } catch (e) {
        console.log(e);
      }
    }

    return finalString;
  },
};
