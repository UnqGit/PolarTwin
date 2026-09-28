import fs from 'fs';

const hierarchy = JSON.parse(fs.readFileSync('./data/compiled/Maitri/hierarchy.json', 'utf8'));
const connections = JSON.parse(fs.readFileSync('./data/compiled/Maitri/connection.json', 'utf8'));

// Build parent map
const nodeMap = new Map();
const parentMap = new Map();
hierarchy.forEach(n => {
  nodeMap.set(n.name, n);
  if (n.parent) {
    parentMap.set(n.name, n.parent);
  }
});

function isAncestor(child, ancestor) {
  let curr = parentMap.get(child);
  while (curr) {
    if (curr === ancestor) return true;
    curr = parentMap.get(curr);
  }
  return false;
}

let loopCount = 0;
let ancestorCount = 0;

connections.forEach(c => {
  if (c.source === c.target) {
    console.log(`Self loop: ${c.source} -> ${c.target}`);
    loopCount++;
  } else if (isAncestor(c.source, c.target)) {
    console.log(`Ancestor loop (source is descendant of target): ${c.source} -> ${c.target}`);
    ancestorCount++;
  } else if (isAncestor(c.target, c.source)) {
    console.log(`Ancestor loop (target is descendant of source): ${c.source} -> ${c.target}`);
    ancestorCount++;
  }
});

console.log(`Total self loops: ${loopCount}`);
console.log(`Total ancestor loops: ${ancestorCount}`);
