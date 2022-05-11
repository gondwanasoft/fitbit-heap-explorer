var fs = require('fs');
const { exit } = require('process');

if (process.argv.length < 3 ) {
  console.log('Usage: fitbit-heap-explorer <snapshot>');
  process.exit(1);
}

const MAX_SEARCH_QUEUE_LENGTH = 10000;    // increase this if heap contains large arrays
const nodes = [], edges = [];
let verbosity = 2;                      // how much output to produce: 9 gives everything

parseFile(process.argv[2], analyseHeap);

function parseFile(filename, analysisFunction) {
  // filename: path and name of file obtained from memory-profiler.
  // analysisFunction: function to be called after file has been read.
  fs.readFile(filename, function(err, data) {   // async!
    if (err)
      console.log(`Error reading file "${filename}": ${err}`);
    else
      analysisFunction(JSON.parse(data));
  });
}

function analyseHeap(heap) {
  // heap: object

  constructHeapRepresentation(heap);

  // All of these functions are optional:
  const mySymbolNames = [
    "myExportedStringVariable",
    "myNumberVariable",
    "myStringVariable",
    "myObject",
    "myStringField",
    "myNumberField",
    "myArrayVariable",
    "Array",
    "myLocalVariable",
    "mySumArrayFunction",
    "setInterval",
    "JSON",
    "stringify",
    "myOuterFunction",
    "memory",
    "js",
    "used",
    "total",
    "myNumberSumVariable",
    "mySharedVariable",
    "myInnerFunction1",
    "myInnerFunction2",
    "length"
  ];  // taken from index.js.map
  // TODO 3.9 read mySymbolNames from names in index.js.map

  listNodesWithRepr();
  listNodesWithReprIn(mySymbolNames);
  listNodesWithPosition();
  listNodesWithType('Closure');
  listNodesWithType('Code');
  listNodesWithType('Sourcemap');
  listEdgesWithName();      // usually hundreds of JS and API entries
  listEdgesWithNameIn(mySymbolNames);
  listRoots();
  listLeaves();
  listUnlinked();
  listManyTo(7);
  listManyFrom(7);
  listOwnSizeAbove(23);
  traceNodeUp(279545795);
  traceNodeDown(279545731);
  traceRetainedNodes(279536115);
  findCommonFrom(279546217, 279545305);
  findCommonTo(279546217, 279546217);
  findPathBetween(279546217, 279545305);

  console.log('Finished.');
}

function constructHeapRepresentation(heap) {
  // Populates nodes[] and edges[] based on heap object, and links them.
  readNodes(heap['nodes']);
  readEdges(heap['edges']);
  linkNodes();
}

function readNodes(nodesObject) {
  let nodeCount = 0, nodeValue, size = 0;

  for (nodeKey in nodesObject) {
    nodeValue = nodesObject[nodeKey];

    size += nodeValue.size;

    nodeValue.from = [];  // edges in which this node is 'to'
    nodeValue.to = [];    // edges in which this node is 'from'

    nodes[nodeValue.id] = nodeValue;
    nodeCount++;
  }

  console.log(`Found ${nodeCount} nodes.`);
  console.log(`   Total heap size: ${size} bytes.\r\n`);
}

function readEdges(edgesObject) {
  console.log('Finding edges:');

  let fields = [];

  for (edgeKey in edgesObject) {
    edgeValue = edgesObject[edgeKey];
    for (fieldKey in edgeValue) {
      //console.log(`${fieldKey}`);
      if (fields.indexOf(fieldKey) < 0) fields.push(fieldKey);
    }

    edgeValue.fromNode = nodes[edgeValue.from];
    edgeValue.toNode = nodes[edgeValue.to];

    if (isUnique(edgeValue)) edges.push(edgeValue);
  }
  //console.log(`${JSON.stringify(fields)}`);
  console.log(`   Found ${edgesObject.length} edges (${edges.length} of which are unique).\r\n`);

  function isUnique(newEdge) {
    // Returns true if edgeValue isn't already in edges.
    for (const edge of edges) {
      if (edge.from === newEdge.from && edge.to === newEdge.to) {
        if (verbosity >= 9) {
          console.log('   Found duplicate edges:');
          dumpEdge(edge, '      ');
          dumpEdge(newEdge, '      ');
        }
        if (edge.type !== newEdge.type) {
          console.warn('      Warning: edges with different types are connecting the same nodes!');
        }
        if (edge.name !== newEdge.name) {
          console.warn('      Warning: edges with different names are connecting the same nodes!');
        }
        return false;
      }
    }
    return true;
  }
}

function linkNodes() {
  // Connect nodes via edges.
  let edgeValue;

  for (edgeKey in edges) {
    edgeValue = edges[edgeKey];
    //fromNode = nodes[edgeValue.from];
    edgeValue.fromNode.to.push(edgeValue);
    //toNode = nodes[edgeValue.to];
    edgeValue.toNode.from.push(edgeValue);
  }
}

function listNodesWithRepr() {
  // Lists nodes that have repr values and which are probably user-code (ie, not system) nodes.
  // Can include source code variable (but not function) names and string literal values.
  let nodeValue, nodeCount = 0;

  console.log('Node(s) with repr:');
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.repr) {
      if (nodeValue.id >= 0x1000000) dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function listNodesWithReprIn(values) {
  // Lists nodes that have a repr value contained within the values[] string array.
  // It could be useful to ignore nodes with id<0x1000000 and/or size===0.
  let nodeValue, nodeCount = 0;

  console.log('Node(s) with repr in array:');
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.repr && values.indexOf(nodeValue.repr) >= 0) {
      if (verbosity >= 9 || nodeValue.id > 0x1000000) dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function listNodesWithPosition() {
  // Lists nodes that have position values.
  // Includes source code functions, including anonymous functions.
  let nodeValue, nodeCount = 0;

  console.log('Node(s) with position:');
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.position) {
      dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function listNodesWithType(nodeType) {
  // Lists nodes that have type===nodeType.
  let nodeValue, nodeCount = 0;

  console.log(`Node(s) with type==="${nodeType}":`);
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.type === nodeType) {
      dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function listEdgesWithName() {
  // Can include source code variable and function names.
  let edgeValue, edgeCount = 0;

  console.log('Edges with name:');
  for (edgeKey in edges) {
    edgeValue = edges[edgeKey];
    if (edgeValue.name) {
      if (verbosity>=9) console.log(`   type=${edgeValue.type} from=${edgeValue.from} to=${edgeValue.to} name=${edgeValue.name}`);    // usually hundreds of them!
      edgeCount++;
    }
  }
  console.log(`   (${edgeCount} edges found.)\r\n`);
}

function listEdgesWithNameIn(values) {
  // Lists edges that have a name value contained within the values[] string array.
  let edgeValue, edgeCount = 0;

  console.log('Edges with name in array:');
  for (edgeKey in edges) {
    edgeValue = edges[edgeKey];
    if (edgeValue.name && values.indexOf(edgeValue.name) >= 0) {
      console.log(`   type=${edgeValue.type} from=${edgeValue.from} to=${edgeValue.to} name=${edgeValue.name}`);    // usually hundreds of them!
      edgeCount++;
    }
  }
  console.log(`   (${edgeCount} edges found.)\r\n`);
}

function listRoots() {
  // Lists nodes that have no edges coming FROM other nodes and which are probably user-code (ie, not system) nodes.
  let nodeValue, rootCount = 0;

  console.log('Root node(s):');
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.from.length === 0) {
      if (nodeValue.id >= 0x1000000) dumpNode(nodeValue);
      rootCount++;
    }
  }
  console.log(`   (${rootCount} nodes found.)\r\n`);
}

function listLeaves() {
  // Lists nodes that have no edges going TO other nodes. (There are too many to be useful.)
  let nodeValue, leafCount = 0;

  console.log('Leaf node(s):');
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.to.length === 0) {
      if (nodeValue.id >= 0x1000000) dumpNode(nodeValue);
      leafCount++;
    }
  }
  console.log(`   (${leafCount} nodes found.)\r\n`);
}

function listUnlinked() {
  // Lists nodes that have no edges going TO or FROM other nodes.
  let nodeValue, nodeCount = 0;

  console.log('Unlinked node(s):');
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.to.length === 0 && nodeValue.from.length === 0) {
      if (nodeValue.id >= 0x1000000) dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function listManyTo(atLeast) {
  // Lists nodes with atLeast the specified number of edges to other nodes.
  let nodeValue, nodeCount = 0;

  console.log(`Node(s) with at least ${atLeast} edges to other nodes:`);
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.to.length >= atLeast) {
      if (nodeValue.id >= 0x1000000) dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function listManyFrom(atLeast) {
  // Lists nodes with atLeast the specified number of edges from other nodes.
  let nodeValue, nodeCount = 0;

  console.log(`Node(s) with at least ${atLeast} edges from other nodes:`);
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.from.length >= atLeast) {
      if (nodeValue.id >= 0x1000000) dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function listOwnSizeAbove(above) {
  // Lists nodes with own size above the specified number of bytes.
  let nodeValue, nodeCount = 0;

  console.log(`Node(s) with own size above ${above} bytes:`);
  for (nodeKey in nodes) {
    nodeValue = nodes[nodeKey];
    if (nodeValue.size > above) {
      dumpNode(nodeValue);
      nodeCount++;
    }
  }
  console.log(`   (${nodeCount} nodes found.)\r\n`);
}

function traceNodeUp(id) {
  // Trace node with specified id up through parents ('from' edges).
  // Returns array of nodes.
  if (verbosity >= 0) console.log(`Tracing node ${id} upwards (ie, through 'from' edges):`);
  let startNode = nodes[id];
  if (!startNode) {
    console.error(`   Can't find node with id=${id}`);
    return;
  }

  let visitedNodes = [];
  traceNodeUpRecurse(startNode, '   ');

  // delete all node.visited:
  visitedNodes.forEach(node => {
    delete node.visited;
  });

  if (verbosity >= 0) console.log('   Finished.\r\n');
  return visitedNodes;

  function traceNodeUpRecurse(node, indent) {
    if (verbosity >= 0) dumpNode(node, indent);
    if (node.visited) {
      if (verbosity >= 0) console.warn(indent + 'Already visited this node - not going there again');
      return;
    }
    node.visited = true;
    visitedNodes.push(node);
    node.from.forEach(edgeToParent => {
      if (verbosity >= 9) dumpEdge(edgeToParent, indent + '   ', 'Following ');
      traceNodeUpRecurse(edgeToParent.fromNode, indent + '   ');
    });
  }
}

function traceNodeDown(id) {
  // Trace node with specified id down through children ('to' edges).
  // Returns array of nodes.
  if (verbosity >= 0) console.log(`Tracing node ${id} downwards (ie, through 'to' edges):`);
  let startNode = nodes[id];
  if (!startNode) {
    console.error(`   Can't find node with id=${id}`);
    return;
  }

  let visitedNodes = [];
  traceNodeDownRecurse(startNode, '   ');

  // delete all node.visited:
  visitedNodes.forEach(node => {
    delete node.visited;
  });

  if (verbosity >= 0) console.log('   Finished.\r\n');
  return visitedNodes;

  function traceNodeDownRecurse(node, indent) {
    if (verbosity >= 0) dumpNode(node, indent);
    if (node.visited) {
      if (verbosity >= 0) console.warn(indent + 'Already visited this node - not going there again');
      return;
    }
    node.visited = true;
    visitedNodes.push(node);
    //console.log(`${indent}Children (${node.to.length}):`);
    node.to.forEach(edgeToChild => {
      if (verbosity >= 9) dumpEdge(edgeToChild, indent + '   ', 'Following ');
      traceNodeDownRecurse(edgeToChild.toNode, indent + '   ');
    });
  }
}

function traceRetainedNodes(id) {
  // Trace node with specified id down through retained children ('to' edges).
  // Retained nodes are those that are reachable ONLY from the object with specified id.
  // Uses breath-first search.

  console.log(`Tracing node ${id} down through retained children:`);
  let node = nodes[id];
  if (!node) {
    console.error(`   Can't find node with id=${id}`);
    return;
  }
  dumpNode(node, '   ', 'Starting node: ');

  node.isRetained = true;
  node.visited = true;
  node.depth = 0;         // what level of descendant this node is from id node
  let retainedNodeCount = 1, maxQueueLength = 1;  // so far, just the id node itself
  let retainedSize = node.size;
  let retainedNodeWithSizeCount = node.size? 1 : 0; // how many retained nodes have size>0
  let maxDepth = 0;

  // Initialise search queue with id node:
  const searchQueue = [node];   // queue of retained nodes to search (breath-first) for retained subordinate child nodes

  // Process nodes in searchQueue until it's empty:
  let searchNode, childNode, isRetained, childDepth;
  let retainedNodes = [node];   // list of all retained nodes, so we can remove the temporary properties added to them
  while (searchQueue.length) {
    if (verbosity >= 9) console.log(`   Queue length: ${searchQueue.length}`);
    maxQueueLength = Math.max(maxQueueLength, searchQueue.length);
    if (searchQueue.length > MAX_SEARCH_QUEUE_LENGTH) {  // TODO 9 find sensible way to ensure thorough but finite processing
      console.error('Queue too big - aborting');
      exit(1);
    }
    searchNode = searchQueue.shift();
    if (searchNode.to.length) {
      if (verbosity >= 6) console.log(`   Considering node ${searchNode.id}. Searching its ${searchNode.to.length} child(ren).`);
    } else {  // searchNode has no children
      if (verbosity >= 8) console.log(`   Considering node ${searchNode.id}. Searching its ${searchNode.to.length} child(ren).`);
    }

    // Consider all children of searchNode:
    childDepth = searchNode.depth + 1;

    //searchNode.to.forEach(edgeToChild => {
    for (const edgeToChild of searchNode.to) {
      //console.log(`   ${searchNode.id} has child ${edgeToChild.to}`);
      if (verbosity >= 6) dumpEdge(edgeToChild, '      ');
      childNode = edgeToChild.toNode;

      if (childNode.visited) {
        if (verbosity >= 5) console.warn(`      Child node ${childNode.id} has already been visited - skipping.\r\n`);
        continue;
      }

      childNode.visited = true;

      if (verbosity >= 6) console.log(`      Checking up to ${childNode.from.length} parent(s) of ${childNode.id} (all of which must be retained for ${childNode.id} to be retained).`);
      isRetained = childNode.from.every(edgeToParent => {    // look at each parent of node
        //console.log(`${indent}   ${childNode.id} has edge from ${edgeToParent.fromNode.id} (retained=${edgeToParent.fromNode.isRetained})`);  // can produce LOTS of output
        if (verbosity >= 6) dumpEdge(edgeToParent, '         ', '', ` retained=${edgeToParent.fromNode.isRetained}`);    // can produce LOTS of output
        return edgeToParent.fromNode.isRetained;  // if ANY parent of childNode isn't retained, then the child isn't retained either
      });   // end of look-at-each-parent-of-child loop

      // Logging:
      if (isRetained) {
        if (childNode.size) {
          if (verbosity >= 2) dumpNode(childNode, '      ', `Conclusion: ${searchNode.id} has child `, ` RETAINED`);
        } else {  // childNode size is 0
          if (verbosity >= 3) dumpNode(childNode, '      ', `Conclusion: ${searchNode.id} has child `, ` RETAINED`);
        }
      } else {  // not retained
        if (verbosity >= 4) dumpNode(childNode, '      ', `Conclusion: ${searchNode.id} has child `, ` NOT retained`);
      }

      // If childNode is retained, update stats and enqueue it for subsequent processing:
      if (isRetained) {
        childNode.isRetained = true;
        retainedNodeCount++;
        retainedSize += childNode.size;
        if (childNode.size) retainedNodeWithSizeCount++;
        childNode.depth = childDepth;
        maxDepth = Math.max(maxDepth, childDepth);
        searchQueue.push(childNode);
        retainedNodes.push(childNode);
      }
    }; // end of look-at-each-child loop
  }   // end of queue loop

  console.log('   Finished.');
  console.log(`      Nodes retained: ${retainedNodeCount}`);
  console.log(`      Nodes with non-zero size retained: ${retainedNodeWithSizeCount}`);
  console.log(`      Memory retained: ${retainedSize} bytes`);
  console.log(`      Maximum node depth: ${maxDepth}`);
  console.log(`      Maximum processing queue length: ${maxQueueLength}\r\n`);

  // Remove all isRetained and visited values when done, so we can reuse traceRetainedNodes():
  retainedNodes.forEach(node => {
    delete node.isRetained;
    delete node.visited;
    delete node.depth;
  });

  // TODO 3.6 can retained size of children be determined by this?
}

function findCommonFrom(node1Id, node2Id) {
  console.log(`Finding nodes reachable via 'from' edges of both ${node1Id} and ${node2Id}:`);
  const oldVerbosity = verbosity;
  verbosity = -1; // to stop traceNodeUp from saying anything
  const node1FromArray = traceNodeUp(node1Id);
  const node2FromArray = traceNodeUp(node2Id);
  verbosity = oldVerbosity;

  let nodeCount = 0;
  node1FromArray.forEach(node1From => {
    const commonNode = node2FromArray.find(node2From => node1From.id === node2From.id);
    if (commonNode) {
      dumpNode(commonNode);
      nodeCount++;
    }
  });

  console.log(`   (${nodeCount} node(s) found.)\r\n`);
}

function findCommonTo(node1Id, node2Id) {
  console.log(`Finding nodes reachable via 'to' edges of both ${node1Id} and ${node2Id}:`);
  const oldVerbosity = verbosity;
  verbosity = -1; // to stop traceNodeDown from saying anything
  const node1ToArray = traceNodeDown(node1Id);
  const node2ToArray = traceNodeDown(node2Id);
  verbosity = oldVerbosity;

  let nodeCount = 0;
  node1ToArray.forEach(node1To => {
    const commonNode = node2ToArray.find(node2To => node1To.id === node2To.id);
    if (commonNode) {
      dumpNode(commonNode);
      nodeCount++;
    }
  });

  console.log(`   (${nodeCount} node(s) found.)\r\n`);
}

function findPathBetween(node1Id, node2Id) {
  console.log(`Finding paths between ${node1Id} and ${node2Id}:`);

  let node1 = nodes[node1Id];
  if (!node1) {
    console.error(`   Can't find node with id=${node1Id}`);
    return;
  }

  const MAX_PATH_LENGTH = 10;  // limit depth-first search to this many nodes
  const path = [node1];
  let pathsSearched = 0, pathsFound = 0;
  let visitedNodes = [];

  recurse(path);

  console.log('\r\n   Finished.');
  console.log(`      ${pathsSearched} path(s) searched.`);
  console.log(`      ${pathsFound} path(s) found between specified nodes.\r\n`);

  // delete all node.visited:
  visitedNodes.forEach(node => delete node.visited);

  function recurse(path) {
    const pathEndNode = path.at(-1);
    if (verbosity >= 9) {
      console.log('');
      dumpPath(path);
      console.log(`   Considering ${pathEndNode.id}`);
    }

    if (pathEndNode.visited) {
      if (verbosity >= 9) console.warn('   Already visited this node - not going there again');
      return;
    }

    pathEndNode.visited = true;
    visitedNodes.push(pathEndNode);
    pathsSearched++;

    if (pathEndNode.id === node2Id) { // node is a match
      if (verbosity >= 1) dumpPath(path, undefined, 'Path found: ');  // there is no need to recurse from here
      pathsFound++;
    } else {  // node is not a match, so recurse from it (unless it's already at MAX_PATH_LENGTH
      if (path.length >= MAX_PATH_LENGTH) {
        if (verbosity >= 9) console.log('   Not recursing because path is at MAX_PATH_LENGTH');
        return;
      }

      // It's unlikely that large 'from' or 'to' lists need to be followed. Skipping those could usefully reduce the search space.
      pathEndNode.from.forEach(edge => {  // iterate through all 'from' edges
        if (verbosity >= 8) console.log(`   Following ${pathEndNode.id} edge from ${edge.from}`);
        recurse(path.concat([edge.fromNode]));
      });
      if (verbosity >= 8) console.log(`   ${pathEndNode.id} has no more 'from' edges to follow.`);

      pathEndNode.to.forEach(edge => {  // iterate through all 'to' edges
        if (verbosity >= 8) console.log(`   Following ${pathEndNode.id} edge to ${edge.to}`);
        recurse(path.concat([edge.toNode]));
      });
      if (verbosity >= 8) console.log(`   ${pathEndNode.id} has no more 'to' edges to follow.`);
    }
  }
}

//***************************************************************************************************** dump objects *****

function dumpNode(node, indent='   ', prefix='', suffix='') {
  // node: node object.
  // indent: spaces to print before prefix.
  // prefix: string to print before this node's fields.
  let nodeString = `${indent}${prefix}node id=${node.id} type=${node.type} size=${node.size} from=${node.from.length} to=${node.to.length}`;
  if (node.repr) nodeString += ` repr="${node.repr}"`;
  if (node.position) nodeString += ` position=${JSON.stringify(node.position)}`;
  if (node.depth !== undefined) nodeString += ` depth=${node.depth}`;
  console.log(nodeString + suffix);
}

function dumpEdge(edge, indent='   ', prefix='', suffix='') {
  let edgeString = `${indent}${prefix}edge type=${edge.type} from=${edge.from} to=${edge.to}`
  if (edge.name) edgeString += ` name=${edge.name}`;
  console.log(edgeString + suffix);
}

function dumpPath(path, indent='   ', prefix='') {
  let nodeIds = '';
  path.forEach(node => nodeIds += ' ' + node.id)
  console.log(`${indent}${prefix}path =${nodeIds}`);
}

// TODO 3.7 Trace which nodes are retaining a given node (by tracing up through parents: from)
// TODO 3.8 Output HTML 'tree' with expand-collapse nodes and retained size (etc) of each; edge types and names.
// TODO 3.9 Allow useful input: symbols from source code, or app root node