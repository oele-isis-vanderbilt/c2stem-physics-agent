export default class SegmentParser {
  constructor() {
    this.segment = "";
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
        return this.parentChildMap[parent];
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
  extractSegment(action) {
    let actionType = this.getActionType(action);
    let id = this.getBlockId(action);
    if (id) {
      if (actionType === "addBlock") {
        let actionName = this.getSValue(action);
        if (actionName) {
          if (actionName === "receiveGo" || actionName === "doSimulationStep") {
            this.parentNameMap[id] = actionName;
            this.segment = "initialization";
            this.segmentMap[id] = this.segment;
            return this.segment;
          } else if (actionName === "doIf") {
            this.parentNameMap[id] = actionName;
            this.segment = "initialization";
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
              if (
                this.parentNameMap[rootParent] === "doIf" &&
                (this.segmentMap[parent] === "conditional-clause" ||
                  this.segmentMap[parent] ===
                    "updating-variables-under-conditons")
              ) {
                if (this.segmentMap[parent] === "conditional-clause") {
                  location = "0";
                } else if (
                  this.segmentMap[parent] ===
                  "updating-variables-under-conditons"
                ) {
                  location = "1";
                }
              }
              if (!(id in this.parentChildMap)) {
                this.parentChildMap[id] = rootParent;
              }
              this.segment = this.generateSegment(rootParent, location);
              this.segmentMap[id] = this.segment;
              return this.segment;
            }
          }
        } else {
          if (id in this.segmentMap) {
            return this.segmentMap[id];
          } else {
            return this.segment;
          }
        }
      } else if (actionType === "setField" || actionType === "removeBlock") {
        if (id in this.parentChildMap) {
          let parent = this.parentChildMap[id];
          this.segment = this.generateSegment(parent);
          this.segmentMap[id] = this.segment;
          return this.segment;
        } else {
          this.segmentMap[id] = "initialization";
          return "initialization";
        }
      } else {
        this.segmentMap[id] = this.segment;
        return this.segment;
      }
    } else {
      this.segmentMap[id] = this.segment;
      return this.segment;
    }
  }
}
