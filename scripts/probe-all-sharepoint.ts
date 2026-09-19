const API_PROXY_URL = "https://api.lamdong.gov.vn/RestApi/Readjson";


interface SiteTarget {
  tag: string;
  name: string;
  siteUrl: string;
  listTitles: string[];
}

const targets: SiteTarget[] = [
  {
    tag: "01_qppl_home",
    name: "QPPL Chung Tỉnh",
    siteUrl: "https://w3.lamdong.gov.vn/sites/qppl",
    listTitles: ["Quản lý văn bản", "Quản lý văn bản chỉ đạo", "Văn bản QPPL"]
  },
  {
    tag: "02_nghi_quyet",
    name: "Nghị quyết HĐND",
    siteUrl: "https://w3.lamdong.gov.vn/sites/qppl/qppl",
    listTitles: ["Quản lý văn bản", "vbqppl", "Nghị quyết"]
  },
  {
    tag: "03_quyet_dinh",
    name: "Quyết định UBND",
    siteUrl: "https://w3.lamdong.gov.vn/sites/qppl/qppl",
    listTitles: ["Quản lý văn bản", "vbqppl", "Quyết định"]
  },
  {
    tag: "04_the_loai_toan_bo",
    name: "Chỉ đạo điều hành - Toàn bộ",
    siteUrl: "https://w3.lamdong.gov.vn/sites/qppl/the-loai",
    listTitles: ["Quản lý văn bản", "Văn bản chỉ đạo điều hành", "Quản lý văn bản chỉ đạo"]
  },
  {
    tag: "05_the_loai_quyet_dinh",
    name: "Chỉ đạo điều hành - Quyết định",
    siteUrl: "https://w3.lamdong.gov.vn/sites/qppl/the-loai",
    listTitles: ["Quản lý văn bản", "Quyết định", "Văn bản chỉ đạo điều hành"]
  },
  {
    tag: "06_dbnd",
    name: "HĐND tỉnh (dbnd)",
    siteUrl: "https://w3.lamdong.gov.vn/sites/dbnd",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "07_vpubnd",
    name: "VP UBND tỉnh (vpubnd)",
    siteUrl: "https://w3.lamdong.gov.vn/sites/vpubnd",
    listTitles: ["Quản lý văn bản chỉ đạo"]
  },
  {
    tag: "08_bqlkhucn",
    name: "BQL các Khu Công Nghiệp",
    siteUrl: "https://w3.lamdong.gov.vn/sites/liza",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "09_bqlgt",
    name: "Ban QL Dự án Giao thông",
    siteUrl: "https://w3.lamdong.gov.vn/sites/bqlgt",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "10_socongthuong",
    name: "Sở Công thương",
    siteUrl: "https://w3.lamdong.gov.vn/sites/sct",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "11_bandantoc",
    name: "Sở Dân tộc và Tôn giáo",
    siteUrl: "https://w3.lamdong.gov.vn/sites/bandantoc",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "13_skhcn",
    name: "Sở Khoa học & Công nghệ",
    siteUrl: "https://w3.lamdong.gov.vn/sites/skhcn",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "14_snv",
    name: "Sở Nội vụ",
    siteUrl: "https://w3.lamdong.gov.vn/sites/snv",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "15_snnptnt",
    name: "Sở Nông nghiệp & Môi trường",
    siteUrl: "https://w3.lamdong.gov.vn/sites/snnptnt",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "16_sngv",
    name: "Sở Ngoại vụ",
    siteUrl: "https://w3.lamdong.gov.vn/sites/songoaivu",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "17_stc",
    name: "Sở Tài chính",
    siteUrl: "https://w3.lamdong.gov.vn/sites/stc",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "18_stp",
    name: "Sở Tư pháp",
    siteUrl: "https://w3.lamdong.gov.vn/sites/stp",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "19_svhttdl",
    name: "Sở Văn hóa Thể thao & Du lịch",
    siteUrl: "https://w3.lamdong.gov.vn/sites/svhttdl",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "20_sxd",
    name: "Sở Xây dựng",
    siteUrl: "https://w3.lamdong.gov.vn/sites/sxd",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "21_syt",
    name: "Sở Y tế",
    siteUrl: "https://w3.lamdong.gov.vn/sites/syt",
    listTitles: ["Quản lý văn bản"]
  },
  {
    tag: "22_thanhtra",
    name: "Thanh tra tỉnh",
    siteUrl: "https://w3.lamdong.gov.vn/sites/thanhtra",
    listTitles: ["Quản lý văn bản"]
  }
];

async function probeTarget(t: SiteTarget) {
  console.log(`\n=== [${t.tag}] ${t.name} (${t.siteUrl}) ===`);
  
  // First, probe web lists to discover exact list titles if needed
  const getListsUrl = `${t.siteUrl}/_api/web/lists?$select=Title,ItemCount,Hidden&$filter=Hidden%20eq%20false`;
  try {
    const res = await fetch(API_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json;odata=verbose",
        "User-Agent": "Mozilla/5.0 (compatible; VBAIBot/1.0)",
      },
      body: JSON.stringify({ SourceUrl: getListsUrl }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const lists = data?.d?.results || [];
      const docLists = lists.filter((l: any) => 
        l.Title.toLowerCase().includes("văn bản") || 
        l.Title.toLowerCase().includes("chỉ đạo") ||
        l.Title.toLowerCase().includes("quản lý") ||
        l.Title.toLowerCase().includes("document") ||
        l.ItemCount > 0
      );
      console.log(`  📋 Tìm thấy ${lists.length} lists, các list tài liệu đáng chú ý:`);
      for (const dl of docLists) {
        console.log(`     - "${dl.Title}" (ItemCount: ${dl.ItemCount})`);
      }
    }
  } catch (e) {
    // ignore
  }

  // Next, try querying items for known list titles
  for (const lt of t.listTitles) {
    const nextUrl = `${t.siteUrl}/_api/web/lists/getByTitle('${encodeURIComponent(lt)}')/items?$orderby=Modified%20desc&$top=2`;
    try {
      const res = await fetch(API_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;odata=verbose",
          "User-Agent": "Mozilla/5.0 (compatible; VBAIBot/1.0)",
        },
        body: JSON.stringify({ SourceUrl: nextUrl }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data: any = await res.json();
        const items = data?.d?.results || [];
        if (items.length > 0) {
          console.log(`  ✅ List "${lt}": Đọc thành công ${items.length} items mẫu!`);
          for (const it of items) {
            const num = it.S_x1ed1__x002f_K_x00fd__x0020_hi || it.Title || it.ID;
            const trichYeu = it.Tr_x00ed_ch_x0020_y_x1ebf_u || it.Title || "";
            const date = it.Ng_x00e0_y || it.Modified || "";
            console.log(`     ↳ ID ${it.ID}: [${num}] ${trichYeu.slice(0, 70)}... (${date})`);
          }
          return;
        }
      }
    } catch (err) {
      // ignore
    }
  }
}

async function main() {
  for (const t of targets) {
    await probeTarget(t);
  }
}

main().catch(console.error);

export {};
