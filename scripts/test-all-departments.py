import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

PROXY_URL = "https://api.lamdong.gov.vn/RestApi/Readjson"

sites_to_test = [
    ("HĐND (dbnd)", "http://w3.lamdong.gov.vn/sites/dbnd", "Quản lý văn bản"),
    ("UBND (vpubnd)", "http://w3.lamdong.gov.vn/sites/vpubnd", "Quản lý văn bản chỉ đạo"),
    ("QPPL Toàn tỉnh (qppl)", "http://w3.lamdong.gov.vn/sites/qppl", "Quản lý văn bản"),
    ("Sở Tư pháp (stp)", "http://w3.lamdong.gov.vn/sites/stp", "Quản lý văn bản"),
    ("Sở Tài chính (stc)", "http://w3.lamdong.gov.vn/sites/stc", "Quản lý văn bản"),
    ("Sở Nội vụ (snv)", "http://w3.lamdong.gov.vn/sites/snv", "Quản lý văn bản"),
    ("Sở Xây dựng (sxd)", "http://w3.lamdong.gov.vn/sites/sxd", "Quản lý văn bản"),
    ("Sở Y tế (syt)", "http://w3.lamdong.gov.vn/sites/syt", "Quản lý văn bản"),
    ("Sở KH&CN (skhcn)", "http://w3.lamdong.gov.vn/sites/skhcn", "Quản lý văn bản"),
    ("Sở NN&MT (snnptnt)", "http://w3.lamdong.gov.vn/sites/snnptnt", "Quản lý văn bản"),
    ("Sở VHTTDL (svhttdl)", "http://w3.lamdong.gov.vn/sites/svhttdl", "Quản lý văn bản"),
    ("Sở Công thương (sct)", "http://w3.lamdong.gov.vn/sites/sct", "Quản lý văn bản"),
    ("Sở Ngoại vụ (songoaivu)", "http://w3.lamdong.gov.vn/sites/songoaivu", "Quản lý văn bản"),
    ("Ban Dân tộc (bandantoc)", "http://w3.lamdong.gov.vn/sites/bandantoc", "Quản lý văn bản"),
    ("Thanh tra tỉnh (thanhtra)", "http://w3.lamdong.gov.vn/sites/thanhtra", "Quản lý văn bản"),
    ("BQL Khu CN (liza)", "http://w3.lamdong.gov.vn/sites/liza", "Quản lý văn bản"),
    ("BQL Dự án GT (bqlgt)", "http://w3.lamdong.gov.vn/sites/bqlgt", "Quản lý văn bản"),
]

print(f"Testing SharePoint API Proxy across {len(sites_to_test)} provincial departments...\n")

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json;odata=verbose",
    "User-Agent": "Mozilla/5.0 (compatible; VBAIBot/1.0)",
}

for name, base_url, list_title in sites_to_test:
    target_url = f"{base_url}/_api/web/lists/getByTitle('{urllib.parse.quote(list_title)}')/items?$top=3&$orderby=Modified%20desc"
    payload = json.dumps({"SourceUrl": target_url}).encode('utf-8')
    req = urllib.request.Request(PROXY_URL, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            results = data.get('d', {}).get('results', [])
            print(f"✅ {name}: Thành công! Lấy được {len(results)} văn bản mẫu.")
            if results:
                sample = results[0]
                title = sample.get('Title') or sample.get('Tr_x00ed_ch_x0020_y_x1ebf_u') or 'N/A'
                date = sample.get('Modified') or sample.get('Ng_x00e0_y') or 'N/A'
                print(f"   ↳ VB mới nhất: {title[:80]} ({date})")
    except urllib.error.HTTPError as he:
        print(f"❌ {name}: HTTP {he.code} - {he.reason}")
    except Exception as e:
        print(f"❌ {name}: Lỗi {e}")

