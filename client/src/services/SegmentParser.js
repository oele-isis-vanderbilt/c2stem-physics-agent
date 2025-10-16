import store from "@/store";

export default class SegmentParser {
  constructor() {
    this.segment = "initialization";
    this.parentNameMap = {};
    this.parentChildMap = {};
    this.segmentMap = {};
  }
  getSValue(obj) {
    try {
      // Navigate to the nested structure: rawAction.args[0]
      const scriptString = obj?.rawAction?.args?.[0];

      if (!scriptString || typeof scriptString !== "string") {
        return null;
      }

      // Use regex to find the s attribute value
      const sMatch = scriptString.match(/\bs="([^"]+)"/);

      if (sMatch && sMatch[1]) {
        return sMatch[1];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  getBlockId(obj) {
    return String(obj?.block || "").includes("item") ? obj.block : null;
  }

  getActionType(action) {
    return action.rawType;
  }

  getRootParent(parent) {
    if (parent in this.parentNameMap) {
      return parent;
    } else {
      if (parent in this.parentChildMap) {
        return this.getRootParent(this.parentChildMap[parent]);
      }
    }
    return false;
  }

  generateSegment(parent, location = null) {
    parent = this.parentNameMap[parent];
    switch (parent) {
      case "receiveGo":
        return "initialization";
      case "doSimulationStep":
        return "updating-variables-every-sim-step";
      case "doIf":
        if (location) {
          if (location === "0") {
            return "conditional-clause";
          } else if (location === "1") {
            return "updating-variables-under-conditons";
          }
        } else {
          return "conditional-clause";
        }
    }
  }

  findParentBlockID(data, targetId) {
    // eslint-disable-next-line no-unused-vars
    function search(node, parentId = null) {
      // Check if current node has an ID
      if (node.id) {
        // Check next.next chain
        if (node.next?.next?.id === targetId) {
          return node.id;
        }

        // Recursively search in next.next
        if (node.next?.next) {
          const result = search(node.next.next, node.id);
          if (result) return result;
        }

        // Search in contained array
        if (node.contained && node.contained.length > 0) {
          for (const item of node.contained) {
            if (item.id === targetId) {
              return node.id;
            }
            const result = search(item, node.id);
            if (result) return result;
          }
        }

        // Search in underlay array
        if (node.underlay && node.underlay.length > 0) {
          for (const item of node.underlay) {
            if (item.id === targetId) {
              return node.id;
            }
            const result = search(item, node.id);
            if (result) return result;
          }
        }
      }

      return null;
    }

    // Search through the top-level array
    for (const item of data) {
      const result = search(item);
      if (result) return result;
    }

    return targetId; // Return the same ID if parent not found
  }

  extractSegment(action) {
    let actionType = this.getActionType(action);
    let id = this.getBlockId(action);
    if (id) {
      if (actionType === "addBlock") {
        let actionName = this.getSValue(action);
        if (actionName) {
          if (actionName === "receiveGo") {
            this.parentNameMap[id] = actionName;
            this.segment = "initialization";
            this.segmentMap[id] = this.segment;
            return this.segment;
          } else if (actionName === "doSimulationStep") {
            this.parentNameMap[id] = actionName;
            this.segment = "updating-variables-every-sim-step";
            this.segmentMap[id] = this.segment;
            return this.segment;
          } else if (actionName === "doIf") {
            this.parentNameMap[id] = actionName;
            this.segment = "conditional-clause";
          }
        }
        this.segmentMap[id] = this.segment;
        return this.segment;
      } else if (actionType === "moveBlock") {
        let location = "";
        let parent = "";
        let actionName = this.getSValue(action);
        if (actionName) {
          if (actionName === "doIf") {
            if (!(id in this.parentNameMap)) {
              this.parentNameMap[id] = actionName;
            }
            if (action.rawAction?.args?.[1]?.element) {
              parent = action.rawAction?.args?.[1]?.element;
              if (parent in this.parentNameMap) {
                if (this.parentNameMap[parent] === "receiveGo") {
                  this.segment = "initialization";
                  this.segmentMap[id] = this.segment;
                  return this.segment;
                }
              }
            }
            this.segment = "conditional-clause";
            this.segmentMap[id] = this.segment;
            return this.segment;
          } else {
            if (action.rawAction?.args?.[1]?.element) {
              parent = action.rawAction?.args?.[1]?.element;
            } else if (action.rawAction?.args?.[1]) {
              parent = action.rawAction?.args?.[1];
            }
            if (parent) {
              if (parent.includes("/")) {
                let parentSplitList = parent.split("/");
                parent = parentSplitList[0];
                location = parentSplitList[1];
              }
              let rootParent = this.getRootParent(parent);
              if (!rootParent && !(parent in this.parentNameMap)) {
                this.segmentMap[id] = this.segment;
                this.parentChildMap[id] = parent;
                return this.segment;
              }
              if (this.segmentMap[rootParent] === "initialization") {
                this.parentChildMap[id] = parent;
                this.segment = "initialization";
                this.segmentMap[id] = this.segment;
                return this.segment;
              }
              if (
                this.parentNameMap[rootParent] === "doIf" &&
                (this.segmentMap[parent] === "conditional-clause" ||
                  this.segmentMap[parent] ===
                    "updating-variables-under-conditons")
              ) {
                if (
                  this.segmentMap[parent] === "conditional-clause" &&
                  !(parent in this.parentNameMap)
                ) {
                  location = "0";
                } else if (
                  this.segmentMap[parent] ===
                    "updating-variables-under-conditons" &&
                  !(parent in this.parentNameMap)
                ) {
                  location = "1";
                }
              }
              if (!(id in this.parentChildMap)) {
                this.parentChildMap[id] = parent;
              }
              if (rootParent) {
                this.segment = this.generateSegment(rootParent, location);
              } else {
                this.segment = this.generateSegment(parent, location);
              }
              if (this.segment) {
                this.segmentMap[id] = this.segment;
              } else {
                this.segmentMap[id] = "initialization";
                this.segment = "initialization";
              }
              return this.segment;
            }
          }
        } else {
          if (
            action.rawAction?.args?.[1]?.element &&
            action.rawAction?.args?.[1]?.loc === "top"
          ) {
            let currentBlockID = action.rawAction?.args?.[1]?.element;
            let treeRoots = store.getters.getTreeRoots;
            this.parentChildMap[currentBlockID] = this.findParentBlockID(
              treeRoots,
              currentBlockID
            );
          } else if (action.rawAction?.args?.[1]?.element) {
            let parent = action.rawAction?.args?.[1]?.element;
            if (id in this.parentNameMap) {
              this.segment = this.segmentMap[id];
              this.parentChildMap[id] = parent;
              return this.segment;
            }
            if (parent.includes("/")) {
              let parentSplitList = parent.split("/");
              parent = parentSplitList[0];
              location = parentSplitList[1];
            }
            if (parent in this.parentChildMap) {
              this.parentChildMap[id] = parent;
              let rootParent = this.getRootParent(parent);
              if (
                rootParent in this.parentNameMap &&
                this.parentNameMap[rootParent] === "doIf"
              ) {
                if (
                  this.segmentMap[id] === "updating-variables-under-conditons"
                ) {
                  location = "1";
                } else if (this.segmentMap[id] === "conditional-clause") {
                  location = "0";
                }
              }
              this.segment = this.generateSegment(rootParent, location);
              this.segmentMap[id] = this.segment;
              return this.segment;
            } else if (parent in this.parentNameMap) {
              this.parentChildMap[id] = parent;
              if (
                this.parentNameMap[id] === "doIf" &&
                this.parentNameMap[parent] !== "receiveGo"
              ) {
                this.segment = "conditional-clause";
                this.segmentMap[id] = this.segment;
                return this.segment;
              } else {
                this.segment = this.generateSegment(parent, location);
                this.segmentMap[id] = this.segment;
                return this.segment;
              }
            } else if (id in this.parentChildMap) {
              let parent = this.parentChildMap[id];
              let rootParent = this.getRootParent(parent);
              this.segment = this.generateSegment(rootParent);
              this.segmentMap[id] = this.segment;
              return this.segment;
            }
          }
          if (id in this.segmentMap) {
            return this.segmentMap[id];
          } else {
            return this.segment;
          }
        }
      } else if (actionType === "setField" || actionType === "removeBlock") {
        // if (id in this.parentChildMap) {
        //   let parent = this.parentChildMap[id];
        //   this.segment = this.generateSegment(parent);
        //   this.segmentMap[id] = this.segment;
        //   return this.segment;
        if (id in this.segmentMap) {
          this.segment = this.segmentMap[id];
          return this.segment;
        } else {
          this.segmentMap[id] = "initialization";
          return "initialization";
        }
      } else {
        if (id in this.segmentMap) {
          return this.segmentMap[id];
        } else {
          return "issue";
        }
      }
      // } else {
      //   if (id in this.parentChildMap) {
      //     let parent = this.parentChildMap[id];
      //     let rootParent = this.getRootParent(parent);
      //     let location = null;
      //     if (
      //       action.rawAction?.args?.[3]?.[1]?.element &&
      //       action.rawAction?.args?.[3]?.[1]?.element.includes("/")
      //     ) {
      //       let parentSplitList =
      //         action.rawAction?.args?.[3]?.[1]?.element.split("/");
      //       parent = parentSplitList[0];
      //       location = parentSplitList[1];
      //       this.segment = this.generateSegment(rootParent, location);
      //     } else {
      //       if (
      //         rootParent in this.parentNameMap &&
      //         this.parentNameMap[rootParent] === "doIf"
      //       ) {
      //         if (
      //           this.segmentMap[id] === "updating-variables-under-conditons"
      //         ) {
      //           location = "1";
      //         } else if (this.segmentMap[id] === "conditional-clause") {
      //           location = "0";
      //         }
      //       }
      //       if (id in this.parentNameMap) {
      //         this.segment = this.generateSegment(id, location);
      //       } else {
      //         this.segment = this.generateSegment(rootParent, location);
      //       }
      //     }
      //     this.segmentMap[id] = this.segment;
      //     return this.segment;
      //   } else if (id in this.parentNameMap) {
      //     return this.generateSegment(id);
      //   } else {
      //     this.segmentMap[id] = this.segment;
      //     return this.segment;
      //   }
      // }
    } else {
      this.segmentMap[id] = this.segment;
      return this.segment;
    }
  }
}
