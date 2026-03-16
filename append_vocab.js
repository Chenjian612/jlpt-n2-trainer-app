const fs = require('fs');
const path = './src/data/seed/n2_vocab_base.json';

function appendVocab(newItems) {
  let data = [];
  if (fs.existsSync(path)) {
    const fileContent = fs.readFileSync(path, 'utf8');
    data = JSON.parse(fileContent);
  }
  
  // Filter out any that already exist
  const existingIds = new Set(data.map(item => item.id));
  const itemsToAdd = newItems.filter(item => !existingIds.has(item.id));
  
  data = data.concat(itemsToAdd);
  
  fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Appended ${itemsToAdd.length} items. Total items: ${data.length}`);
}

const input = fs.readFileSync(0, 'utf-8');
if (input.trim()) {
    try {
        appendVocab(JSON.parse(input));
    } catch (e) {
        console.error("Invalid JSON input");
    }
}
