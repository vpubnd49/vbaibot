async function probeGetDocumentPage2() {
  const url = "https://lamdong.edu.vn/vi/sgd-van-ban/?param=sgd_document";
  const res = await fetch(url);
  const text = await res.text();

  const idx = text.indexOf('var obj = {');
  console.log("Snippet near var obj = {\n", text.slice(idx, idx + 1500));
}

probeGetDocumentPage2().catch(console.error);
