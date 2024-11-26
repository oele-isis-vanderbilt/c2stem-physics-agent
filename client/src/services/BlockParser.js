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

    function parseBlocks(node) {
      let rootName = "";
      if (node.id) {
        rootName = MapBlocks.get(node.name);
      }
      for (let nextNode of node.next.contained) {
        if (nextNode) {
          if (!nextNode.id) {
            value = nextNode.name ? nextNode.name : "no value";
          }

          finalString += rootName.replace("%n", "(" + value + ")") + "\n";
          parseBlocks(nextNode);
        }
      }
      if (node.next.next) {
        parseBlocks(node.next.next);
      }
    }
    return finalString;
  },
};
