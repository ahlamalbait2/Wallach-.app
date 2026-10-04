import sqlite3
import json
import os
import sys

DB_PATH = "wallach.sqlite"
DATA_PATH = "extracted.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY,
    page_num INTEGER,
    content TEXT
);

CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY,
    title TEXT,
    page INTEGER,
    content TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
    title, content,
    content='sections',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
);
"""


def build():
    if not os.path.exists(DATA_PATH):
        print("ERROR: " + DATA_PATH + " not found")
        sys.exit(1)

    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)

    print("Inserting pages...")
    conn.executemany(
        "INSERT INTO pages (page_num, content) VALUES (?, ?)",
        [(p["page"], p["text"]) for p in data["pages"]]
    )

    print("Inserting sections...")
    conn.executemany(
        "INSERT INTO sections (title, page, content) VALUES (?, ?, ?)",
        [(s["title"], s["page"], s["content"]) for s in data["sections"]]
    )

    print("Building search index...")
    conn.execute("INSERT INTO sections_fts(sections_fts) VALUES('rebuild')")
    conn.commit()

    pc = conn.execute("SELECT COUNT(*) FROM pages").fetchone()[0]
    sc = conn.execute("SELECT COUNT(*) FROM sections").fetchone()[0]
    print("Pages: " + str(pc) + ", Sections: " + str(sc))

    conn.close()
    size_mb = os.path.getsize(DB_PATH) / 1024 / 1024
    print("DB ready: " + DB_PATH + " (" + str(round(size_mb, 1)) + " MB)")


if __name__ == "__main__":
    build()
