import { fetchQpplItems } from "../src/qppl/qppl-crawler.js";

async function main() {
  console.log("Testing fetchQpplItems for ubnd...");
  const ubndItems = await fetchQpplItems("ubnd", 3);
  console.log(`ubnd fetched ${ubndItems.length} items:`);
  for (const item of ubndItems) {
    console.log(` - ID ${item.ID}: ${item.Title} | ${item.S_x1ed1__x002f_K_x00fd__x0020_hi}`);
  }

  console.log("\nTesting fetchQpplItems for hdnd...");
  const hdndItems = await fetchQpplItems("hdnd", 3);
  console.log(`hdnd fetched ${hdndItems.length} items:`);
  for (const item of hdndItems) {
    console.log(` - ID ${item.ID}: ${item.Title} | ${item.S_x1ed1__x002f_K_x00fd__x0020_hi}`);
  }
}

main().catch(console.error);
