export default {
  generateDOT() {
    // const blocks = JSON.parse(window.sessionStorage.getItem("blocks"));
    // const treeRoots = JSON.parse(window.sessionStorage.getItem("treeRoots"));
    const blocks = this.$store.getters.getBlocks;
    const treeRoots = this.$store.getters.getTreeRoots;

    let dot = "graph Tree {\nnode [shape = none, ordering = out];\n";
    for (let block of Object.values(blocks)) {
      dot += `${block.id} [label = <${block.name}>];\n`;
    }

    const connectNode = (node) => {
      for (let nextNode of node.next.contained) {
        if (nextNode) {
          // Use ephemeral id for ephemeral blocks (e.g. numbers)
          const nextid = nextNode.id
            ? nextNode.id
            : `block_${String(Math.random()).slice(2)}`;
          if (!nextNode.id) {
            dot += `${nextid} [label = <${
              nextNode.name ? nextNode.name : "no value"
            }>];\n`;
          }

          dot += `${node.id} -- ${nextid}\n`;
          connectNode(nextNode);
        }
      }

      if (node.next.next) {
        dot += `${node.id} -- ${node.next.next.id} [dir = forward]\n`;
        connectNode(node.next.next);
      }
    };

    for (let root of treeRoots) {
      connectNode(root);
    }

    dot += `}`;
    console.log(dot);
    return dot;
  },
};
