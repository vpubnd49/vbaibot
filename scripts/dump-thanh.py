import sqlite3

conn = sqlite3.connect('/var/www/vbaibot/data/zalo-agent.db')
c = conn.cursor()

def search_text(term):
    print(f"\n--- SEARCHING FOR: {term} ---")
    tables = ['thanhtra_documents', 'shared_knowledge', 'memories', 'qppl_documents']
    for t in tables:
        cols = [col[1] for col in c.execute(f"PRAGMA table_info({t})").fetchall()]
        for col in cols:
            try:
                matches = c.execute(f"SELECT id, {col} FROM {t} WHERE CAST({col} AS TEXT) LIKE '%{term}%'").fetchall()
                if matches:
                    print(f"Found in {t}.{col}: {len(matches)} rows")
                    for m in matches[:3]:
                        print(f"  ID #{m[0]}: {str(m[1])[:120]}")
            except Exception as e:
                pass

search_text("186")
search_text("1428")
search_text("8650")
search_text("3240")
search_text("3.240")
search_text("18,6")
search_text("4494")
