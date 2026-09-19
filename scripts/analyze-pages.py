import sys
import os

# Fix windows terminal encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import urllib.request
import json
import re
import ssl
import html

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

summary = []

for tag, url in urls:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=25) as resp:
            raw = resp.read()
            text = raw.decode('utf-8', errors='ignore')
            
            # If edu.vn site
            if "lamdong.edu.vn" in url:
                title_m = re.search(r'<title>(.*?)</title>', text, re.I | re.S)
                title = title_m.group(1).strip() if title_m else ""
                forms = re.findall(r'<form\b[^>]*action="([^"]*)"[^>]*>', text, re.I)
                tables = re.findall(r'<table\b[^>]*>', text, re.I)
                # Look for document rows or pagination or API
                doc_rows = re.findall(r'<tr\b[^>]*>(.*?)</tr>', text, re.I | re.S)
                ajax_urls = re.findall(r'(/vi/[^"\'\s]+\?param=[^"\'\s]+)', text, re.I)
                summary.append({
                    "tag": tag,
                    "url": url,
                    "type": "EDU_PORTAL",
                    "title": title,
                    "forms": forms[:5],
                    "tables_count": len(tables),
                    "doc_rows_count": len(doc_rows),
                    "ajax_urls": list(set(ajax_urls))[:10],
                    "html_length": len(text)
                })
                print(f"[{tag}] EDU Portal: {title} | Rows: {len(doc_rows)} | Tables: {len(tables)}")
                continue

            # SharePoint site
            title_m = re.search(r'<title>(.*?)</title>', text, re.I | re.S)
            title = title_m.group(1).strip() if title_m else ""
            
            site_info = {}
            ws_match = re.search(r'"webServerRelativeUrl"\s*:\s*"([^"]+)"', text)
            if ws_match:
                site_info["webServerRelativeUrl"] = ws_match.group(1)
            web_title_m = re.search(r'"webTitle"\s*:\s*"([^"]+)"', text)
            if web_title_m:
                site_info["webTitle"] = web_title_m.group(1)

            # Find all webparts directly from HTML
            # Look for properties JSON in webpart definitions
            webparts_info = []
            
            # Method 1: search for ListDocsGeneral or MenuNews or properties
            for wp_m in re.finditer(r'data-sp-webpartdata="([^"]+)"', text):
                raw_wp = wp_m.group(1)
                try:
                    wp_decoded = html.unescape(raw_wp)
                    wp_j = json.loads(wp_decoded)
                    props = wp_j.get("properties", {})
                    webparts_info.append({
                        "title": wp_j.get("title"),
                        "description": wp_j.get("description"),
                        "properties": props
                    })
                except Exception:
                    pass

            # Method 2: search inside CanvasContent1 if not found
            if not webparts_info:
                canvas_match = re.search(r'"CanvasContent1"\s*:\s*"(.*?)(?<!\\)"', text)
                if canvas_match:
                    raw_canvas = canvas_match.group(1)
                    # replace json escape
                    try:
                        raw_canvas = json.loads('"' + raw_canvas + '"')
                    except Exception:
                        pass
                    raw_canvas = html.unescape(raw_canvas)
                    for wp_m in re.finditer(r'data-sp-webpartdata="([^"]+)"', raw_canvas):
                        try:
                            wp_j = json.loads(html.unescape(wp_m.group(1)))
                            webparts_info.append({
                                "title": wp_j.get("title"),
                                "description": wp_j.get("description"),
                                "properties": wp_j.get("properties", {})
                            })
                        except Exception:
                            pass

            summary.append({
                "tag": tag,
                "url": url,
                "type": "SHAREPOINT",
                "title": title,
                "site_info": site_info,
                "webparts": webparts_info
            })
            print(f"[{tag}] SP: {site_info.get('webTitle', title)} ({site_info.get('webServerRelativeUrl')}) - WP count: {len(webparts_info)}")
            for wp in webparts_info:
                p = wp.get("properties", {})
                info = {k: p[k] for k in ["title", "listName", "lstMenuNews", "soBanNganh"] if k in p}
                if "lstSoBanNganh" in p:
                    info["lstSoBanNganh_count"] = len(p["lstSoBanNganh"])
                print(f"   -> WP [{wp.get('title')}]: {info}")

    except Exception as e:
        print(f"[{tag}] ERROR: {e}")
        summary.append({
            "tag": tag,
            "url": url,
            "error": str(e)
        })

with open("summary_urls.json", "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

print("\nSuccessfully wrote summary_urls.json!")
