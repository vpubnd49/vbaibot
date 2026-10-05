const fs = require('fs');
const path = require('path');

const corpusPath = path.resolve('src/knowledge/noi-chinh-corpus.json');
if (!fs.existsSync(corpusPath)) {
  console.error('Not found:', corpusPath);
  process.exit(1);
}

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
console.log('Total documents:', corpus.length);

const categories = {};
for (const doc of corpus) {
  const cat = doc.category || 'Gốc';
  if (!categories[cat]) categories[cat] = [];
  categories[cat].push(doc);
}

const sortedKeys = Object.keys(categories).sort((a, b) => categories[b].length - categories[a].length);

console.log(`Found ${sortedKeys.length} categories:`);
for (const cat of sortedKeys) {
  console.log(`[${cat}]: ${categories[cat].length} docs`);
}

// Write summary of category samples
fs.writeFileSync('scripts/category_summary.json', JSON.stringify(sortedKeys.map(k => ({
  category: k,
  count: categories[k].length,
  sampleFiles: categories[k].slice(0, 10).map(d => ({
    title: d.title,
    filename: d.filename,
    type: d.type,
    textPreview: (d.text || '').slice(0, 200).replace(/\s+/g, ' ')
  }))
})), null, 2), 'utf8');

console.log('Saved summary to scripts/category_summary.json');
