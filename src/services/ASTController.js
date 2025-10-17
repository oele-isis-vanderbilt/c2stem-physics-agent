import ed from "edit-distance";
import Helper from "@/services/Helpers";

export default class ASTController {
  constructor(blocks, treeRoots, actionList, store) {
    this.blocks = blocks;
    this.treeRoots = treeRoots;
    this.actions = actionList;
    this.store = store;
  }

  normalizeTree(root) {
    try {
      if (!root || !root.next) {
        console.error(
          "ASTController: Invalid root object in normalizeTree",
          root
        );
        return root;
      }

      if (root.name === "reportGreaterThan") {
        root.name = "reportLessThan";
        if (root.next.contained && Array.isArray(root.next.contained)) {
          root.next.contained.reverse();
        }
      }

      if (root.name === "reportEquals") {
        if (root.next.contained && Array.isArray(root.next.contained)) {
          root.next.contained.sort((a, b) => {
            return (a.name || "").localeCompare(b.name || "");
          });
        }
      }

      if (root.next.contained && Array.isArray(root.next.contained)) {
        for (var i = 0; i < root.next.contained.length; i++) {
          if (root.next.contained[i])
            this.normalizeTree(root.next.contained[i]);
        }
      }

      if (root.next.next) this.normalizeTree(root.next.next);

      return root;
    } catch (error) {
      console.error("ASTController: Error in normalizeTree", error, root);
      return root;
    }
  }

  ed = require("edit-distance");
  correctTree = this.normalizeTree(
    JSON.parse(
      '{"id":"item_9","name":"receiveGo","modifiedBefore":false,"connectedBefore":false,"next":{"next":{"id":"item_10","name":"doIf","modifiedBefore":false,"connectedBefore":true,"next":{"contained":[{"id":"item_11","name":"reportEquals","modifiedBefore":false,"connectedBefore":true,"next":{"contained":[{"name":"2","modifiedBefore":true,"connectedBefore":false,"next":{"contained":[],"underlay":[]}},{"name":"3","modifiedBefore":true,"connectedBefore":false,"next":{"contained":[],"underlay":[]}}],"underlay":[]}},{"id":"item_16","name":"forward","modifiedBefore":false,"connectedBefore":true,"next":{"contained":[{"name":"10","modifiedBefore":false,"connectedBefore":false,"next":{"contained":[],"underlay":[]}}],"underlay":[]}}],"underlay":[{"name":"","modifiedBefore":false,"connectedBefore":false,"next":{"contained":[],"underlay":[]}}]}},"contained":[],"underlay":[]}}'
    )
  );

  // Map of blocks (id -> block object)

  // blocks = {};
  // // Array of root blocks
  // treeRoots = [];
  // // List of actions for action sequence
  // actions = [];

  // Tree understanding functions
  // let insert, remove, update, children;
  remove;
  insert = (this.remove = () => {
    return 1;
  });
  update = (nodeA, nodeB) => {
    return nodeA.name !== nodeB.name ? 1 : 0;
  };
  children = (node) => {
    let ret = [];
    if (node.next.next) ret.push(node.next.next);
    return [...ret, ...node.next.contained];
  };
  findParentId(data, searchId) {
    function search(obj, parentId = null) {
      // If current object has the search ID
      if (obj && obj.id === searchId) {
        return parentId === null ? obj.id : parentId;
      }

      // Only update parentId if current object has an ID
      const currentParentId = obj && obj.id ? obj.id : parentId;

      // Search in 'next' property
      if (obj && obj.next) {
        const result = search(obj.next, currentParentId);
        if (result !== null) return result;
      }

      // Search in 'contained' array
      if (obj && obj.contained && Array.isArray(obj.contained)) {
        for (const item of obj.contained) {
          const result = search(item, currentParentId);
          if (result !== null) return result;
        }
      }

      // Search in 'underlay' array
      if (obj && obj.underlay && Array.isArray(obj.underlay)) {
        for (const item of obj.underlay) {
          const result = search(item, currentParentId);
          if (result !== null) return result;
        }
      }

      return null;
    }

    if (Array.isArray(data)) {
      for (const root of data) {
        const result = search(root);
        if (result !== null) return result;
      }
      return null;
    }

    return search(data);
  }

  actionListener = (action, segmentparser = null) => {
    try {
      if (!action || !action.type) {
        console.error("ASTController: Invalid action received", action);
        return;
      }

      if (!action.args || !Array.isArray(action.args)) {
        console.error("ASTController: Invalid action args", action);
        return;
      }

      // Block class -- used to create standardized objects
      // that represent new blocks in C2STEM
      class Block {
        constructor(id, name, contained) {
          // C2STEM official block id
          // Set to undefined if "ephemeral" block, like a number input (e.g. move *10* steps)
          this.id = id;
          // Block name (from C2STEM)
          // Displayed in graph
          this.name = name;
          // Has this block been modified before? (for epemeral blocks only)
          this.modifiedBefore = false;
          // Has this block been connected before?
          this.connectedBefore = false;
          // Next block (connections)
          this.next = {
            // Next block in linear sequence
            next: undefined,
            // Blocks contained in block -- numbers, sets of statements (like in an if statement), etc.
            contained,
            // Blocks currently hidden in contained.
            // If you put a variable over a number, it gets hidden,
            // and if you remove the variable, the number shows back up.
            // So it needs to be stored, which we do here.
            underlay: [],
          };
        }
      }

      // Create and root a new block
      // Block based on XML in action from C2STEM
      const addBlock = (action) => {
        try {
          if (!action || !action.args || !action.args[0]) {
            console.error("ASTController: Invalid action in addBlock", action);
            return null;
          }

          // Parse XML and get block and id
          const parser = new DOMParser();
          const data = parser.parseFromString(action.args[0], "text/xml");
          console.log(data);

          const blockEl = data.querySelector("block,custom-block");
          if (!blockEl) {
            console.error(
              "ASTController: No block element found in XML",
              action.args[0]
            );
            return null;
          }

          const id = blockEl.getAttribute("collabId");
          if (!id) {
            console.error(
              "ASTController: No collabId found for block",
              blockEl
            );
            return null;
          }

          // Get all blocks "contained" within block
          let contained = [];
          for (let element of data.getElementsByTagName("l")) {
            while (element.children.length > 0) {
              element = element.children[0];
            }

            contained.push(new Block(undefined, element.innerHTML || "", []));
          }

          // Get name of block
          let name = blockEl.getAttribute("s");
          if (!name) {
            name = "var: " + (blockEl.getAttribute("var") || "unknown");
          }

          // Create block, root, and add to block map
          let block = new Block(id, name, contained);
          this.blocks[id] = block;
          this.treeRoots.push(block);
          return id;
        } catch (error) {
          console.error("ASTController: Error in addBlock", error, action);
          return null;
        }
      };

      // Unroot a block by id
      const unrootBlock = (id) => {
        try {
          if (!id) {
            console.error("ASTController: Invalid id in unrootBlock", id);
            return;
          }
          let i = this.treeRoots.findIndex((el) => el && el.id === id);
          if (i !== -1) {
            this.treeRoots.splice(i, 1);
          }
        } catch (error) {
          console.error("ASTController: Error in unrootBlock", error, id);
        }
      };

      // Root a child, or a part of a child, based on id
      const rootChildren = (id) => {
        try {
          if (!id) {
            console.error("ASTController: Invalid id in rootChildren", id);
            return;
          }

          if (id.includes("/")) {
            // If there's a slash in the id,
            // we're rooting blocks that were part of another block
            const t = id.split("/");
            if (
              !this.blocks[t[0]] ||
              !this.blocks[t[0]].next ||
              !this.blocks[t[0]].next.contained
            ) {
              console.error(
                "ASTController: Invalid block structure in rootChildren",
                id,
                this.blocks[t[0]]
              );
              return;
            }

            const containedBlock = this.blocks[t[0]].next.contained[t[1]];
            if (containedBlock) {
              // Root the block
              this.treeRoots.push(containedBlock);
            }

            // If there's an underlay, restore it, otherwise just remove it from the parent
            if (
              this.blocks[t[0]].next.underlay &&
              this.blocks[t[0]].next.underlay[t[1]]
            ) {
              this.blocks[t[0]].next.contained[t[1]] = this.blocks[
                t[0]
              ].next.underlay.splice(t[1], 1)[0];
            } else {
              this.blocks[t[0]].next.contained.splice(Number(t[1]), 1)[0];
            }
          } else {
            if (!this.blocks[id] || !this.blocks[id].next) {
              console.error(
                "ASTController: Invalid block in rootChildren",
                id,
                this.blocks[id]
              );
              return;
            }

            // Root and remove from parent
            if (this.blocks[id].next.next) {
              this.treeRoots.push(this.blocks[id].next.next);
            }
            this.blocks[id].next.next = undefined;
          }
        } catch (error) {
          console.error("ASTController: Error in rootChildren", error, id);
        }
      };

      let id = action.args[0];
      let actionRep = {
        // Is this a valid action (not a duplicate or unsupported action)?
        valid: true,
        // Action ID
        id: action.id,
        // Action Timestamp
        timestamp: action.time,
        // Action Type (raw, from embedded API)
        rawType: action.type,
        // Action object
        rawAction: action,
        // Type (first, top layer of action)
        type: "construction",
        // Group (second layer of action)
        group: undefined,
        // Type (third layer of action)
        action: undefined,
        // Nearest affected block ID (if relevant)
        block: id,
      };

      // Make decision based on action type
      switch (action.type) {
        // Drag block into window without connecting
        case "addBlock": {
          actionRep.action = "add";
          actionRep.group = "BUILD";
          const id = addBlock(action);
          if (!id) {
            console.error("ASTController: Failed to add block", action);
            actionRep.valid = false;
          }
          actionRep.block = id;
          break;
        }
        // Connect block to other block (or drag block into window + immediately connect)
        case "moveBlock": {
          actionRep.action = "connect";

          // If this block is being connected straight from the block pallete,
          // add it to the window first
          if (action.args[0] && action.args[0].startsWith("<")) {
            actionRep.group = "BUILD";
            id = addBlock(action);
            if (!id) {
              console.error(
                "ASTController: Failed to add block in moveBlock",
                action
              );
              actionRep.valid = false;
              break;
            }
            this.blocks[id].connectedBefore = true;
          } else {
            if (!this.blocks[id]) {
              console.error("ASTController: Block not found in moveBlock", id);
              actionRep.valid = false;
              break;
            }
            if (!this.blocks[id].connectedBefore) {
              actionRep.group = "BUILD";
              this.blocks[id].connectedBefore = true;
            } else {
              actionRep.group = "ADJUST";
            }
          }

          actionRep.block = id;

          if (typeof action.args[1] == "string") {
            if (action.args[3] && typeof action.args[3][1] == "string") {
              rootChildren(action.args[3][1]);
            }

            // If the block is being inserted into a block's condition
            // (e.g. variable into if statement condition), this branch is taken.
            let t = action.args[1].split("/");

            if (!this.blocks[t[0]] || !this.blocks[t[0]].next) {
              console.error(
                "ASTController: Invalid block in moveBlock condition insert",
                t[0]
              );
              actionRep.valid = false;
              break;
            }

            // Get contained block (number after / represents position in contained array)
            // If there's no number, that means the block is replacing the spot of another block
            // (e.g. if we drag a new variable on top of an already inserted variable to replace it),
            // so then we just use the name of the block before the slash, which is the id of the replaced block.
            let containedBlock = t[1]
              ? this.blocks[t[0]].next.contained[t[1]]
              : this.blocks[t[0]];

            if (!containedBlock) {
              console.warn(
                "ASTController: No contained block found, creating empty block"
              );
              containedBlock = new Block(undefined, "", []);
            }

            // If the contained block is an ephemeral block (e.g. just a number) and thus has no id,
            // move it to the underlay, so that way if this new block is ever removed,
            // the number can be restored.
            if (!containedBlock.id) {
              if (!this.blocks[t[0]].next.underlay) {
                this.blocks[t[0]].next.underlay = [];
              }
              this.blocks[t[0]].next.underlay[t[1]] = containedBlock;
            } else {
              // Otherwise, root the block that was there before, since it's being displaced
              // by the new block.
              this.treeRoots.push(containedBlock);
            }

            // If this was a block replacement (described above), then the parent block's position
            // needs to be put in t so we can insert the block into the parent.
            // Otherwise, t already points to the parent.
            if (action.args[4] && action.args[4][1]) {
              t = action.args[4][1].split("/");
            }

            if (!this.blocks[t[0]] || !this.blocks[t[0]].next) {
              console.error(
                "ASTController: Invalid parent block for insertion",
                t[0]
              );
              actionRep.valid = false;
              break;
            }

            // Insert block into parent's contained and unroot it.
            this.blocks[t[0]].next.contained[t[1]] = this.blocks[id];
            unrootBlock(id);
          } else if (action.args[1] && action.args[1].loc === "wrap") {
            // If this block is wrapping around other blocks to bring them into their body
            // (e.g. if statement wrapping around pre-existing blocks), this branch is taken.

            if (
              !action.args[1].element ||
              !this.blocks[action.args[1].element]
            ) {
              console.error(
                "ASTController: Invalid wrap target",
                action.args[1]
              );
              actionRep.valid = false;
              break;
            }

            if (action.args[4] && typeof action.args[4][1] == "object") {
              // If there's a block above the one being inserted,
              // make this its next block.
              const parentElement = action.args[4][1].element;
              if (
                !this.blocks[parentElement] ||
                !this.blocks[parentElement].next
              ) {
                console.error(
                  "ASTController: Invalid parent in wrap operation",
                  parentElement
                );
                actionRep.valid = false;
                break;
              }
              this.blocks[parentElement].next.next = this.blocks[id];
              // Since there's a block above, this isn't a root block, so unroot.
              unrootBlock(id);
            } else {
              // Otherwise, we're wrapping around a root block, so unroot it (this block is now the root).
              unrootBlock(action.args[1].element);
            }

            // Add block we wrapped around to the body of this block.
            if (!this.blocks[id].next.contained) {
              this.blocks[id].next.contained = [];
            }
            this.blocks[id].next.contained.push(
              this.blocks[action.args[1].element]
            );
          } else {
            // If this block came from the "contained" of another block
            // (e.g. if it used to be in the body of an if statement),
            // root it to get it out of where it came from.
            if (action.args[3] && typeof action.args[3][1] == "object") {
              if (action.args[3][1].element) {
                rootChildren(action.args[3][1].element);
              }
            }

            // You can connect multiple blocks at the same time (a stack of blocks).
            // The API will give the first block in the stack, but in order to do
            // an insertion at the bottom, we need the block at the bottom
            // of the stack. So, let's go down the stack until we find the bottom.
            let block = this.blocks[id];
            if (!block || !block.next) {
              console.error(
                "ASTController: Invalid block structure for stack traversal",
                id
              );
              actionRep.valid = false;
              break;
            }
            while (block.next.next) block = block.next.next;

            // Insertion!
            if (!action.args[1] || !action.args[1].loc) {
              console.error(
                "ASTController: Invalid insertion location",
                action.args[1]
              );
              actionRep.valid = false;
              break;
            }

            if (action.args[1].loc === "bottom") {
              // If a block is being inserted under another block,
              // this branch is taken.

              if (!action.args[1].element) {
                console.error(
                  "ASTController: No element specified for bottom insertion"
                );
                actionRep.valid = false;
                break;
              }

              if (action.args[1].element.includes("/")) {
                // If there's a slash, the block is being inserted at the
                // top of the body of another block.
                const t = action.args[1].element.split("/");
                if (
                  !this.blocks[t[0]] ||
                  !this.blocks[t[0]].next ||
                  !this.blocks[t[0]].next.contained
                ) {
                  console.error(
                    "ASTController: Invalid block for bottom insertion",
                    t[0]
                  );
                  actionRep.valid = false;
                  break;
                }
                // If there's any more blocks in the body, link them to the end of the stack.
                block.next.next = this.blocks[t[0]].next.contained[t[1]];
                // Tell the block we're inserting into that this is now the block its body starts with.
                this.blocks[t[0]].next.contained[t[1]] = this.blocks[id];
              } else {
                // Get the parent block (the block we're inserting on the bottom of),
                let parent = this.blocks[action.args[1].element];
                if (!parent || !parent.next) {
                  console.error(
                    "ASTController: Invalid parent for bottom insertion",
                    action.args[1].element
                  );
                  actionRep.valid = false;
                  break;
                }
                // Take whatever's under it and link it to the bottom of the stack,
                block.next.next = parent.next.next;
                // And link the top of the stack with the block above.
                parent.next.next = this.blocks[id];
              }

              // Unroot the block, now that it's been inserted.
              unrootBlock(id);
            } else if (action.args[1].loc === "top") {
              // If the block is being inserted on top of another block,
              // where there are no other blocks above it, this branch is taken.

              if (
                !action.args[1].element ||
                !this.blocks[action.args[1].element]
              ) {
                console.error(
                  "ASTController: Invalid element for top insertion",
                  action.args[1].element
                );
                actionRep.valid = false;
                break;
              }

              // Block below this block is our next block
              block.next.next = this.blocks[action.args[1].element];
              // You can only insert on top of blocks that are roots,
              // so let's unroot the old block.
              unrootBlock(action.args[1].element);
            }
          }

          break;
        }

        case "removeBlock": {
          // this.actionScorer.addScore(action, "remove");
          actionRep.action = "remove";
          actionRep.group = "ADJUST";

          if (typeof action.args[2] == "object") {
            // Normal blocks that have other blocks above them are removed in this branch.

            if (action.args[2].element.includes("/")) {
              // If the block is being removed from the top of a block's body,
              // unlink it from there.
              const t = action.args[2].element.split("/");
              // if (
              //   this.blocks[id] &&
              //   this.blocks[id].next &&
              //   this.blocks[id].next.next
              // ) {
              if (this.blocks[id]) {
                this.blocks[t[0]].next.contained[t[1]] =
                  this.blocks[id].next.next;
              }
            } else {
              // Otherwise, unlink it like a normal linked list.
              // if (
              //   this.blocks[id] &&
              //   this.blocks[id].next &&
              //   this.blocks[id].next.next
              // ) {
              // if (this.blocks[id]) {
              //   this.blocks[action.args[2].element].next.next =
              //     this.blocks[id].next.next;
              // }
              if (this.blocks[id]) {
                this.blocks[action.args[2].element].next.next = undefined;
              }
            }
          } else if (typeof action.args[2] == "string") {
            // Blocks that are part of other block's condition statmements that are being removed
            // take this branch.

            const t = action.args[2].split("/");
            // Replace the block with an empty ephemeral block.
            if (this.blocks[t[0]]) {
              this.blocks[t[0]].next.contained[t[1]] = new Block(
                undefined,
                "",
                []
              );
            }
          } else {
            // Blocks that are on top (root blocks) take this branch.

            // Unroot the block, and move the next block (if it exists) to the root.
            unrootBlock(action.args[0]);
            // if (
            //   this.blocks[action.args[0]] &&
            //   this.blocks[action.args[0]].next &&
            //   this.blocks[action.args[0]].next.next
            // ) {
            // if (this.blocks[action.args[0]]) {
            //   if (this.blocks[action.args[0]].next.next) {
            //     this.treeRoots.push(this.blocks[action.args[0]].next.next);
            //   }
            // }
          }
          // Remove all blocks contained in the block (e.g. variable in condition of if statement.)
          if (this.blocks[id]) {
            this.blocks[id].next.contained.forEach(
              (block) => delete this.blocks[block.id]
            );
            if (Object.keys(this.blocks).length > 1) {
              Object.keys(this.blocks).forEach((key) => {
                if (
                  this.blocks[key].next &&
                  this.blocks[key].next.next &&
                  this.blocks[key].next.next.id === id
                ) {
                  this.blocks[key].next.next = undefined;
                }
              });
            }
            let ids = Helper.getAllIds(this.blocks[id]);
            ids.forEach((id) => {
              delete this.blocks[id];
            });
          }
          break;
        }

        // Remove block from canvas
        // case "removeBlock": {
        //   actionRep.action = "remove";
        //   actionRep.group = "ADJUST";
        //
        //   if (typeof action.args[2] == "object") {
        //     // Normal blocks that have other blocks above them are removed in this branch.
        //
        //     if (action.args[2].element.includes("/")) {
        //       // If the block is being removed from the top of a block's body,
        //       // unlink it from there.
        //       const t = action.args[2].element.split("/");
        //       if (
        //         this.blocks[id] &&
        //         this.blocks[id].next &&
        //         this.blocks[id].next.next
        //       ) {
        //         this.blocks[t[0]].next.contained[t[1]] =
        //           this.blocks[id].next.next;
        //       }
        //     } else {
        //       // Otherwise, unlink it like a normal linked list.
        //       if (this.blocks[id] && this.blocks[id].next) {
        //         this.blocks[action.args[2].element].next.next =
        //           this.blocks[id].next.next;
        //       }
        //     }
        //   } else if (typeof action.args[2] == "string") {
        //     // Blocks that are part of other block's condition statmements that are being removed
        //     // take this branch.
        //
        //     const t = action.args[2].split("/");
        //     // Replace the block with an empty ephemeral block.
        //     this.blocks[t[0]].next.contained[t[1]] = new Block(undefined, "", []);
        //   } else {
        //     // Blocks that are on top (root blocks) take this branch.
        //
        //     // Unroot the block, and move the next block (if it exists) to the root.
        //     unrootBlock(action.args[0]);
        //     if (
        //       this.blocks[action.args[0]] &&
        //       this.blocks[action.args[0]].next &&
        //       this.blocks[action.args[0]].next.next
        //     ) {
        //       if (this.blocks[action.args[0]].next.next) {
        //         this.treeRoots.push(this.blocks[action.args[0]].next.next);
        //       }
        //     }
        //   }
        //
        //   // Remove all blocks contained in the block (e.g. variable in condition of if statement.)
        //   this.blocks[id].next.contained.forEach(
        //     (block) => delete this.blocks[block.id]
        //   );
        //   delete this.blocks[id];
        //   break;
        // }
        // This event is triggerd when a block is disconnected from another block and brought into the canvas,
        // or when the block is simply moved from one place to another on the canvas with no connection changes.
        // We only care about the former case.
        case "setBlockPosition": {
          actionRep.action = "modify";
          actionRep.group = "ADJUST";

          if (typeof action.args[3][1] == "object") {
            // If the block is a normal block, this branch is taken.

            // Root the child, based on its parent.
            rootChildren(action.args[3][1].element);
          } else if (typeof action.args[3][1] == "string") {
            // If the block is part of a condition statement of another block, this branch is taken.

            // Root the child, based on its parent and its index (in the string, separated by a slash).
            rootChildren(action.args[3][1]);
          } else {
            if (this.treeRoots.some((root) => root.id === action.args[0])) {
              actionRep.valid = false;
            } else {
              let parent = this.findParentId(this.treeRoots, action.args[0]);
              rootChildren(parent);
            }
          }

          break;
        }
        // Set numberical field to another number on a block.
        case "setField": {
          actionRep.action = "edit";

          if (!action.args[0]) {
            console.error("ASTController: Missing args[0] in setField");
            actionRep.valid = false;
            break;
          }

          const t = action.args[0].split("/");
          const v = t[2] ? t[2] : t[1];

          if (
            !this.blocks[t[0]] ||
            !this.blocks[t[0]].next ||
            !this.blocks[t[0]].next.contained
          ) {
            console.error("ASTController: Invalid block in setField", t[0]);
            actionRep.valid = false;
            break;
          }

          let block = this.blocks[t[0]].next.contained;

          actionRep.block = t[0];

          if (!block[v]) {
            // If field does not currently exist, create it.
            actionRep.group = "BUILD";
            block[v] = new Block(undefined, "", []);
          } else {
            if (!block[v].modifiedBefore) {
              actionRep.group = "BUILD";
              block[v].modifiedBefore = true;
            } else {
              actionRep.group = "ADJUST";
            }
          }

          block = block[v];
          // Arguments come in either arrays or strings, so assign accordingly.
          if (typeof action.args[1] == "string") {
            if (action.args[1] === action.args[2]) {
              actionRep.valid = false;
            }
            this.blocks[t[0]].next.contained[v].name = action.args[1];
          } else {
            if (action.args[1] === null) {
              this.blocks[t[0]].next.contained[v].name = "";
            } else {
              this.blocks[t[0]].next.contained[v].name =
                action.args[1][0] || "";
            }
          }

          break;
        }
        // Toggle boolean field on boolean block.
        case "toggleBoolean": {
          actionRep.action = "edit";
          actionRep.group = "ADJUST";

          if (!action.args[0]) {
            console.error("ASTController: Missing args[0] in toggleBoolean");
            actionRep.valid = false;
            break;
          }

          const t = action.args[0].split("/");
          actionRep.block = t[0];

          if (
            !this.blocks[t[0]] ||
            !this.blocks[t[0]].next ||
            !this.blocks[t[0]].next.contained ||
            !this.blocks[t[0]].next.contained[0]
          ) {
            console.error(
              "ASTController: Invalid block in toggleBoolean",
              t[0]
            );
            actionRep.valid = false;
            break;
          }

          this.blocks[t[0]].next.contained[0].name = String(action.args[2]);
          break;
        }
        // ASSESSMENT (USER) ACTIONS
        case "openProject": {
          actionRep.type = "assessment";
          actionRep.group = "analysis";
          actionRep.action = "open";
          break;
        }
        case "pressStart": {
          actionRep.type = "assessment";
          actionRep.group = "EXECUTE";
          actionRep.action = "play";
          break;
        }
        case "togglePause": {
          actionRep.type = "assessment";
          actionRep.group = "PLAY_PAUSE";
          actionRep.action = "play";
          break;
        }
        case "startScript": {
          actionRep.type = "assessment";
          actionRep.group = "EXECUTE";
          actionRep.action = "block";
          break;
        }
        case "stopAllScripts": {
          actionRep.type = "assessment";
          actionRep.group = "PLAY_PAUSE";
          actionRep.action = "block";
          break;
        }
        case "addListInput": {
          if (!id) {
            console.error("ASTController: Missing id in addListInput");
            actionRep.valid = false;
            break;
          }
          const t = id.split("/");
          actionRep.group = "BUILD";
          actionRep.block = t[0];

          if (!this.blocks[t[0]] || !this.blocks[t[0]].next) {
            console.error("ASTController: Invalid block in addListInput", t[0]);
            actionRep.valid = false;
            break;
          }

          if (!this.blocks[t[0]].next.contained) {
            this.blocks[t[0]].next.contained = [];
          }

          this.blocks[t[0]].next.contained.push(new Block(undefined, "", []));
          break;
        }
        case "removeListInput": {
          if (!id) {
            console.error("ASTController: Missing id in removeListInput");
            actionRep.valid = false;
            break;
          }
          const t = id.split("/");
          actionRep.group = "ADJUST";
          actionRep.block = t[0];

          if (
            !this.blocks[t[0]] ||
            !this.blocks[t[0]].next ||
            !this.blocks[t[0]].next.contained ||
            this.blocks[t[0]].next.contained.length === 0
          ) {
            console.error(
              "ASTController: Invalid block or empty contained array in removeListInput",
              t[0]
            );
            actionRep.valid = false;
            break;
          }

          this.blocks[t[0]].next.contained.pop();
          break;
        }
        default: {
          actionRep.valid = false;
          console.warn(`action not supported: ${action.type}`);
          break;
        }
      }

      // Attach relevant information to action
      try {
        actionRep.currentTree = JSON.stringify(this.treeRoots);
        actionRep.blockMap = JSON.stringify(this.blocks);
      } catch (error) {
        console.error("ASTController: Error serializing tree/blocks", error);
        actionRep.currentTree = "{}";
        actionRep.blockMap = "{}";
      }

      // Is this a non-assessment action? If so, let's see how close it is to the correct
      // tree, and see if that's better than before (effective/non-effective action).
      // TODO: are we only expecting one tree? how should we choose which one to use for edit distance?
      if (this.treeRoots[0] && actionRep.type !== "assessment") {
        try {
          const ted = ed.ted(
            this.normalizeTree(JSON.parse(JSON.stringify(this.treeRoots[0]))),
            this.correctTree,
            this.children,
            this.insert,
            this.remove,
            this.update
          );
          actionRep.ted = ted.distance;
          let lastEditDistance = Infinity;
          for (let i = this.actions.length - 1; i >= 0; --i) {
            if ("ted" in this.actions[i]) {
              lastEditDistance = this.actions[i].ted;
              break;
            }
          }

          actionRep.effective = ted.distance < lastEditDistance;
        } catch (error) {
          console.error(
            "ASTController: Error calculating edit distance",
            error
          );
          actionRep.ted = -1;
          actionRep.effective = false;
        }
      }

      if (actionRep.valid) {
        this.actions.push(actionRep);
      }
      if (segmentparser) {
        try {
          let segment = segmentparser.extractSegment(actionRep);
          this.store.dispatch("updateSegment", segment);
        } catch (error) {
          console.error("ASTController: Error extracting segment", error);
        }
      }
      // console.log(actions);
      // console.log(treeRoots);
      // window.sessionStorage.setItem(this.blocksName, JSON.stringify(this.blocks));
      // window.sessionStorage.setItem(
      //   this.treeRootsName,
      //   JSON.stringify(this.treeRoots)
      // );
      // window.sessionStorage.setItem(
      //   this.actionListName,
      //   JSON.stringify(this.actions)
      // );
      try {
        if (this.blocks[actionRep.block] && this.blocks[actionRep.block].name) {
          this.store.dispatch(
            "updateCurrentActionName",
            this.blocks[actionRep.block].name
          );
        } else {
          this.store.dispatch("updateCurrentActionName", "");
        }

        this.store.dispatch("updateCurrentGroup", actionRep.group);
        this.store.dispatch("updateTreeRoots", this.treeRoots);
        this.store.dispatch("updateBlocks", this.blocks);
        // this.store.dispatch("updateActions", this.actions);
      } catch (error) {
        console.error("ASTController: Error dispatching store updates", error);
      }
    } catch (error) {
      console.error(
        "ASTController: Critical error in actionListener",
        error,
        action
      );
      // Don't let errors propagate to Construct.vue
    }
  };
}
