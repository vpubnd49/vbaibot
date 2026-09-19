import sqlite3

conn = sqlite3.connect('/var/www/vbaibot/data/zalo-agent.db')
c = conn.cursor()

steps = c.execute("""
    SELECT step_number, text, reasoning, tool_calls, tool_results
    FROM agent_steps 
    WHERE turn_id = 5856 
    ORDER BY id ASC
""").fetchall()

print(f"Total steps in Turn 5856: {len(steps)}")
for s in steps:
    print(f"\n--- STEP {s[0]} ---")
    if s[2]:
        print("REASONING:", s[2])
    if s[3] and s[3] != '[]':
        print("CALLS:", s[3])
    if s[4] and s[4] != '[]':
        print("RESULTS:", s[4][:300])
    if s[1]:
        print("TEXT:\n", s[1])
