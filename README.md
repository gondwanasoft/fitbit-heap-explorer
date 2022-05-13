# fitbit-heap-explorer
`fitbit-heap-explorer` examines data contained in Fitbit OS memory heap snapshots. This could assist with determining how to reduce the memory used by a Fitbit OS clockface/app.

*This is a work-in-progress and is currently not useful.*

---
## Background

Fitbit OS clockfaces/apps run in the [JerryScript](https://github.com/jerryscript-project/jerryscript) JavaScript engine. JerryScript uses a memory heap structure to store most code and data associated with such apps (this is the 64kB or 128kB reported by the Fitbit OS memory API). When an app runs out of memory, it's usually because this heap is full of code and/or data that can't be freed ('garbage-collected').

---
## Heap Representations

### 1. Binary

You can obtain a snapshot of the heap for your app using the `heap-snapshot` command within the Fitbit development CLI. The file thus obtained is in a binary (.bin) format.

> A snapshot can contain multiple instances of a single variable or other in-memory object if that variable is local to a function that is called repeatedly. This is because the JerryScript garbage collector doesn't remove defunct objects from the heap unless it needs to. Morevoer, if you take a `heap-snapshot` when execution is not within a function of interest, *none* of the memory objects local to that function will need to be retained. Therefore, timing of the `heap-snapshot` command may be important.

### 2. JSON

Fitbit has provided [memory-profiler](https://github.com/Fitbit/developer-bridge/tree/master/packages/memory-profiler), which is a utility for converting the binary file into a JSON-formatted file. Install, build and run `memory-profiler` (`cd packages/memory-profiler/lib` then `node cli.js`), passing it the binary heap file and other required arguments.

The JSON file thus obtained contains an array of nodes (each of which may correspond to something stored in the heap), and an array of edges that connect the nodes.

> Mathematically, these structures describe a 'directed graph'. It is not a tree structure (*ie*, hierarchy) because there can be loops between the nodes; *ie*, following the edges from a node can lead back to the same node. Care is required when traversing the structure to avoid infinite loops or recursion.

### 3. Heap Node/Edge Content and Relationships

`fitbit-heap-explorer` is a node.js app that can read JSON-formatted heap snapshot files. Run it using `node fitbit-heap-explorer.js <heapfile.json>`. It will display various things found in the heap, including:

* nodes and edges that contain references to source code symbols
* nodes that correspond to source code functions
* all nodes found by following 'from' edges from a given starting point
* all nodes found by following 'to' edges from a given starting point
* all paths linking a specified pair of nodes
* the total amount of memory retained by a given node and its dependent nodes.

To select which analyses to see, the level of verbosity, and which nodes to examine, edit `fitbit-heap-explorer.js`.

All of the parameters and output are in terms of node numbers, rather than source code symbols or positions applicable to the Fitbit OS app being studied.

### 4. Source Code Linkage, Visualisation and Analysis

It is not yet clear how to relate node numbers to source code entities. For heap analysis to be useful, this needs to be resolved.

It should then be possible to develop or use a visualisation program to explore data usage, leading to conclusions about how to reduce it. Strategies include:

* avoiding the retention of node chains that are no longer required (*ie*, memory leaks)
* reducing the memory size consumed by large but essential data

---
## terser

The heap snapshot contains some symbol names and code positions (line and column numbers). These are usually specified in terms of the minified code executed by JerryScript and contained in `app.fba`, rather than in terms of the original source code (*eg*, index.js). You may therefore see symbol names such as `p` and `q` instead of `stepCount` and `stepDisplayElement`, and incorrect line numbers.

The Fitbit app build process includes several steps that reduce the memory size required for the app, and which improve its performance. One of these is `terser`. Avoiding the use of `terser` will result in the heap snapshot containing symbol names that match those used in the original source code, and line numbers will also be more accurate. The disadvantage is that memory usage will be increased, so this should probably only be attempted when running the app in the Fitbit Simulator (which permits a larger heap).

To disable `terser` for an app:

* Open the file `node_modules\@fitbit\sdk\lib\compile.js` within the project's directory.
* Comment out the terser-related element of the `plugins` array; this is normally the last element in the array and normally starts with `terser_1.default({`.
* Rebuild your app.

Now, when you execute `heap-snapshot` while this app is running, you should see some more informative fields.

---

## Documentation

See `Documentation.docx` in this repository for additional informal notes and links to related web pages. Unfortunately, the latter don't include the specification of JerryScript's heap structure, which can't be found.

---

## Example

See the `test-data` directory in this repository for an example Fitbit OS app, heap.json, and
`fitbit-heap-explorer` output.