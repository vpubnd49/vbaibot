import urllib.request
import urllib.parse
import json
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    ("01_qppl_home", "https://lamdong.gov.vn/sites/qppl/SitePages/Home.aspx"),
    ("02_nghi_quyet", "https://lamdong.gov.vn/sites/qppl/qppl/nghi-quyet/SitePages/Home.aspx"),
    ("03_quyet_dinh", "https://lamdong.gov.vn/sites/qppl/qppl/quyet-dinh/SitePages/Home.aspx"),
    ("04_the_loai_toan_bo", "https://lamdong.gov.vn/sites/qppl/the-loai/toan-bo/SitePages/Home.aspx"),
    ("05_the_loai_quyet_dinh", "https://lamdong.gov.vn/sites/qppl/the-loai/quyet-dinh/SitePages/Home.aspx"),
    ("06_so_dbnd", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/dbnd/SitePages/Home.aspx"),
    ("07_so_vpubnd", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/vpubnd/SitePages/Home.aspx"),
    ("08_so_bqlkhucn", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/bqlkhucn/SitePages/Home.aspx"),
    ("09_so_bqlgt", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/bqlgt/SitePages/Home.aspx"),
    ("10_so_socongthuong", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/socongthuong/SitePages/Home.aspx"),
    ("11_so_bandantoc", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/bandantoc/SitePages/Home.aspx"),
    ("12_sgd_edu", "https://lamdong.edu.vn/vi/sgd-van-ban/?param=sgd_document"),
    ("13_so_skhcn", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/skhcn/SitePages/Home.aspx"),
    ("14_so_snv", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/snv/SitePages/Home.aspx"),
    ("15_so_snnptnt", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/snnptnt/SitePages/Home.aspx"),
    ("16_so_sngv", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/sngv/SitePages/Home.aspx"),
    ("17_so_stc", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/stc/SitePages/Home.aspx"),
    ("18_so_stp", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/stp/SitePages/Home.aspx"),
    ("19_so_svhttdl", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/svhttdl/SitePages/Home.aspx"),
    ("20_so_sxd", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/sxd/SitePages/Home.aspx"),
    ("21_so_syt", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/syt/SitePages/Home.aspx"),
    ("22_so_thanhtra", "https://lamdong.gov.vn/sites/qppl/so-ban-nganh/thanh-tra-tinh/SitePages/Home.aspx"),
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

results = []

for tag, url in urls:
    print(f"\n[{tag}] Fetching: {url}")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            content = resp.read().decode('utf-8', errors='ignore')
            status = resp.status
            
            # Find title
            title_m = re.search(r'<title>(.*?)</title>', content, re.DOTALL | re.IGNORECASE)
            title = title_m.group(1).strip() if title_m else ""
            
            # Find webparts properties
            webparts = []
            # Look for CanvasContent1 or webpart data
            wp_matches = re.findall(r'data-sp-webpartdata="([^"]+)"', content)
            for wp in wp_matches:
                decoded_wp = wp.replace('&quot;', '"').replace('&#123;', '{').replace('&#125;', '}').replace('&amp;', '&')
                try:
                    wp_json = json.loads(decoded_wp)
                    webparts.append({
                        "id": wp_json.get("id"),
                        "title": wp_json.get("title"),
                        "properties": wp_json.get("properties", {})
                    })
                except Exception as e:
                    pass

            print(f"  -> HTTP {status} | Title: {title} | Found {len(webparts)} webparts")
            for wp in webparts:
                p = wp.get("properties", {})
                props_summary = {}
                for k in ["title", "listName", "lstMenuNews", "soBanNganh", "apiUrl", "description"]:
                    if k in p:
                        props_summary[k] = p[k]
                if "lstSoBanNganh" in p:
                    props_summary["lstSoBanNganh_count"] = len(p["lstSoBanNganh"])
                print(f"     WP: {wp.get('title')} -> {props_summary}")
                
            results.append({
                "tag": tag,
                "url": url,
                "status": status,
                "title": title,
                "webparts": webparts
            })
    except Exception as e:
        print(f"  -> ERROR: {e}")
        results.append({
            "tag": tag,
            "url": url,
            "error": str(e)
        })

with open("probe_results.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("\nDone probe! Saved to probe_results.json")
