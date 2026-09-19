const API_PROXY_URL = "https://api.lamdong.gov.vn/RestApi/Readjson";

async function probeQpplConfig() {
  const lists = [
    "Cấu hình tổng hợp văn bản",
    "sobannganh",
    "Văn bản chỉ đạo điều hành",
    "vbqppl",
    "huyenthanhpho"
  ];
  
  for (const l of lists) {
    const url = `https://w3.lamdong.gov.vn/sites/qppl/_api/web/lists/getByTitle('${encodeURIComponent(l)}')/items?$top=10`;
    try {
      const res = await fetch(API_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;odata=verbose",
        },
        body: JSON.stringify({ SourceUrl: url }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data: any = await res.json();
        const items = data?.d?.results || [];
        console.log(`\n=== List "${l}" (${items.length} items) ===`);
        for (const it of items) {
          console.log(` - ID ${it.ID}: Title="${it.Title}", Link/Url="${it.Urls || it.Url || it.Link || it.key || ''}"`);
          // print other non-null keys
          const otherKeys = Object.keys(it).filter(k => !k.startsWith('__') && !['ID','Title','Created','Modified'].includes(k));
          console.log(`   Keys:`, otherKeys.slice(0, 8).map(k => `${k}=${String(it[k]).slice(0, 40)}`));
        }
      }
    } catch (e) {
      console.error(`Error on list ${l}:`, e);
    }
  }
}

probeQpplConfig().catch(console.error);

export {};
