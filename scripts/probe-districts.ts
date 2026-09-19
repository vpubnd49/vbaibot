const API_PROXY_URL = "https://api.lamdong.gov.vn/RestApi/Readjson";

const districtPages = [
  {
    name: "Đức Trọng",
    pageUrl: "https://lamdong.gov.vn/sites/qppl/co-quan/ductrong/SitePages/Home.aspx",
    possibleApiSites: [
      "https://w3.beta.lamdong.gov.vn/sites/ductrong",
      "https://w3.lamdong.gov.vn/sites/ductrong",
      "https://w3.lamdong.gov.vn/sites/qppl/co-quan/ductrong"
    ]
  },
  {
    name: "Di Linh",
    pageUrl: "https://lamdong.gov.vn/sites/qppl/co-quan/dilinh/SitePages/Home.aspx",
    possibleApiSites: [
      "https://w3.beta.lamdong.gov.vn/sites/dilinh",
      "https://w3.lamdong.gov.vn/sites/dilinh",
      "https://w3.lamdong.gov.vn/sites/qppl/co-quan/dilinh"
    ]
  },
  {
    name: "Đạ Tẻh",
    pageUrl: "https://lamdong.gov.vn/sites/qppl/co-quan/dateh/SitePages/Home.aspx",
    possibleApiSites: [
      "https://w3.lamdong.gov.vn/sites/dateh",
      "https://w3.beta.lamdong.gov.vn/sites/dateh",
      "https://w3.lamdong.gov.vn/sites/qppl/co-quan/dateh"
    ]
  }
];

async function inspectDistrict(d: typeof districtPages[0]) {
  console.log(`\n======================================================`);
  console.log(`🔍 KIỂM TRA ĐỊA BÀN: ${d.name}`);
  console.log(`🌐 Page URL: ${d.pageUrl}`);
  console.log(`======================================================`);

  // 1. Fetch HTML page
  try {
    const res = await fetch(d.pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      
      // Extract webServerRelativeUrl & webTitle
      const wsMatch = html.match(/"webServerRelativeUrl"\s*:\s*"([^"]+)"/);
      const wtMatch = html.match(/"webTitle"\s*:\s*"([^"]+)"/);
      
      console.log(`  📄 Portal HTML: HTTP ${res.status} | Title: "${title}"`);
      if (wsMatch) console.log(`  📍 Relative Url: ${wsMatch[1]}`);
      if (wtMatch) console.log(`  🏷️ Web Title: ${wtMatch[1]}`);

      // Look for webpart data
      const wpMatches = html.match(/data-sp-webpartdata="([^"]+)"/g) || [];
      console.log(`  🧩 Số WebPart nhúng trên trang: ${wpMatches.length}`);
      for (const m of wpMatches) {
        try {
          const raw = m.replace('data-sp-webpartdata="', '').slice(0, -1)
            .replace(/&quot;/g, '"')
            .replace(/&#123;/g, '{')
            .replace(/&#125;/g, '}');
          const wpObj = JSON.parse(raw);
          console.log(`     - WebPart: "${wpObj.title}" | desc: "${wpObj.description}"`);
          if (wpObj.properties) {
            console.log(`       props:`, JSON.stringify(wpObj.properties).slice(0, 150));
          }
        } catch {}
      }
    } else {
      console.log(`  ❌ Portal HTML trả mã lỗi: HTTP ${res.status}`);
    }
  } catch (err) {
    console.log(`  ❌ Lỗi khi tải Portal HTML:`, err);
  }

  // 2. Probe API sites
  for (const siteUrl of d.possibleApiSites) {
    console.log(`\n  🔌 Thử kết nối API SharePoint: ${siteUrl}`);
    const getListsUrl = `${siteUrl}/_api/web/lists?$select=Title,ItemCount,Hidden&$filter=Hidden%20eq%20false`;
    try {
      const res = await fetch(API_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;odata=verbose"
        },
        body: JSON.stringify({ SourceUrl: getListsUrl }),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data: any = await res.json();
        const lists = data?.d?.results || [];
        console.log(`     ✅ Thành công! Tìm thấy ${lists.length} lists:`);
        for (const l of lists) {
          if (l.ItemCount > 0 || l.Title.toLowerCase().includes("văn bản")) {
            console.log(`        • List "${l.Title}" (${l.ItemCount} items)`);
          }
        }

        // Try reading 3 latest items from "Quản lý văn bản"
        const readItemsUrl = `${siteUrl}/_api/web/lists/getByTitle('${encodeURIComponent("Quản lý văn bản")}')/items?$orderby=Modified%20desc&$top=3`;
        const resItems = await fetch(API_PROXY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json;odata=verbose"
          },
          body: JSON.stringify({ SourceUrl: readItemsUrl }),
          signal: AbortSignal.timeout(10000)
        });
        if (resItems.ok) {
          const dataItems: any = await resItems.json();
          const items = dataItems?.d?.results || [];
          console.log(`     📑 Đọc được ${items.length} văn bản mới nhất từ List "Quản lý văn bản":`);
          for (const it of items) {
            const num = it.S_x1ed1__x002f_K_x00fd__x0020_hi || it.Title || it.ID;
            const trichYeu = it.Tr_x00ed_ch_x0020_y_x1ebf_u || it.Title || "";
            const date = it.Ng_x00e0_y || it.Modified || "";
            console.log(`        - [${num}] ${trichYeu.replace(/\s+/g, ' ').slice(0, 80)}... (${date})`);
          }
        }
        break; // found working site
      }
    } catch (e) {
      // try next
    }
  }
}

async function main() {
  for (const d of districtPages) {
    await inspectDistrict(d);
  }
}

main().catch(console.error);

export {};
