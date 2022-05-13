// To disable name mangling and line number distortion, comment out the terser_1.default entry in node_modules/@fitbit/sdk/lib/compile.js

import { memory } from 'system';
import { myExportedStringVariable } from './myModule';

let myNumberVariable = 1415926535;
let myStringVariable = "myStringVariableValue";
let myObject = {myStringField: 'myStringFieldValue', myNumberField: 27182818};

let myArrayVariable = new Array(1000);
for (let myLocalVariable=0; myLocalVariable<1000; myLocalVariable++) myArrayVariable[myLocalVariable] = 97530000 + myLocalVariable;

mySumArrayFunction();

setInterval(() => {           // anonymous function: should appear as a Code node but won't have a function name
  // Memory allocated for things in here won't be released immediately, so expect to find multiple instances.
  let myLocalVariable = 42;   // var name used in different scopes
  console.log(`myLocalVariable squared=${myLocalVariable*myLocalVariable}`);
  console.log('my string literal');
  console.log(`myExportedStringVariable = ${myExportedStringVariable}`);   // to ensure vars aren't optimised out of existence
  console.log(`myNumberVariable = ${myNumberVariable}`);   // to ensure var isn't optimised out of existence
  console.log(`myStringVariable = ${myStringVariable}`);   // to ensure var isn't optimised out of existence
  console.log(`myObject = ${JSON.stringify(myObject)}`);
  myOuterFunction();
  console.log("my memory used/total: " + memory.js.used + "/" + memory.js.total);   // about 24000
}, 10000);

function mySumArrayFunction() {
  let myNumberSumVariable = 0;
  for (let myLocalVariable=0; myLocalVariable<1000; myLocalVariable++) myNumberSumVariable += myArrayVariable[myLocalVariable];
  console.log(`myNumberSumVariable is ${myNumberSumVariable}`);
}

function myOuterFunction() {
  let mySharedVariable = 'abcdefghij';     // variable retained in two functions
  for (let myLocalVariable=0; myLocalVariable<5; myLocalVariable++) mySharedVariable = mySharedVariable + mySharedVariable;

  myInnerFunction1();
  myInnerFunction2();

  function myInnerFunction1() {
    console.log(`myInnerFunction1 says ${mySharedVariable}`);
  }

  function myInnerFunction2() {
    console.log(`myInnerFunction2 says ${mySharedVariable.length}`);  // 320
  }
}
