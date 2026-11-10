import sqlite3, hashlib, time
from config import *

def get_db():
    c = sqlite3.connect(DATABASE)
    c.row_factory = sqlite3.Row
    return c

def hash_pw(p):
    return hashlib.sha256(p.encode()).hexdigest()

def init_db():
    c = get_db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        coins INTEGER DEFAULT 0,
        xp INTEGER DEFAULT 0,
        premium INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0,
        created_at REAL,
        last_login REAL
    );
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        text TEXT,
        image TEXT DEFAULT '',
        likes INTEGER DEFAULT 0,
        created_at REAL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT,
        username TEXT,
        text TEXT,
        created_at REAL
    );
    CREATE TABLE IF NOT EXISTS earnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        amount INTEGER,
        description TEXT,
        created_at REAL
    );
    """)
    h = hash_pw(ADMIN["default_password"])
    c.execute("SELECT id FROM users WHERE username=?", (ADMIN["username"],))
    if not c.fetchone():
        c.execute("INSERT INTO users (username,email,password,is_admin,premium,created_at) VALUES (?,?,?,?,?,?)",
                  (ADMIN["username"],"admin@vibehub.com",h,1,1,time.time()))
    else:
        c.execute("UPDATE users SET password=?,is_admin=1,premium=1 WHERE username=?", (h, ADMIN["username"]))
    c.commit()
    c.close()

def record_earning(category, amount, description=""):
    c = get_db()
    c.execute("INSERT INTO earnings (category,amount,description,created_at) VALUES (?,?,?,?)",
              (category, amount, description, time.time()))
    c.commit()
    c.close()

def create_user(username, email, password):
    c = get_db()
    try:
        c.execute("INSERT INTO users (username,email,password,created_at) VALUES (?,?,?,?)",
                  (username, email, hash_pw(password), time.time()))
        c.commit()
        uid = c.execute("SELECT lastrowid").fetchone()[0]
        c.close()
        record_earning("signup", EARN_PER_SIGNUP, f"New user: {username}")
        return uid
    except:
        c.close()
        return None

def login_user(username, password):
    c = get_db()
    row = c.execute("SELECT * FROM users WHERE username=? AND password=?",
                    (username, hash_pw(password))).fetchone()
    if row:
        c.execute("UPDATE users SET last_login=? WHERE id=?", (time.time(), row["id"]))
        c.commit()
        c.close()
        record_earning("login", EARN_PER_LOGIN, f"Login: {username}")
        return dict(row)
    c.close()
    return None

def get_user(uid):
    c = get_db()
    row = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    c.close()
    return dict(row) if row else None

def get_all_users():
    c = get_db()
    rows = c.execute("SELECT id,username,email,coins,xp,premium,is_admin,created_at,last_login FROM users ORDER BY created_at DESC").fetchall()
    c.close()
    return [dict(r) for r in rows]

def create_post(uid, username, text, image=""):
    c = get_db()
    c.execute("INSERT INTO posts (user_id,username,text,image,created_at) VALUES (?,?,?,?,?)",
              (uid, username, text, image, time.time()))
    c.commit()
    c.close()
    record_earning("post", EARN_PER_POST, f"Post by {username}")

def get_posts():
    c = get_db()
    rows = c.execute("SELECT * FROM posts ORDER BY created_at DESC LIMIT 50").fetchall()
    c.close()
    return [dict(r) for r in rows]

def get_earnings_breakdown():
    c = get_db()
    total = c.execute("SELECT COALESCE(SUM(amount),0) FROM earnings").fetchone()[0]
    cats = c.execute("SELECT category,SUM(amount) as total,COUNT(*) as count FROM earnings GROUP BY category").fetchall()
    recent = c.execute("SELECT * FROM earnings ORDER BY created_at DESC LIMIT 20").fetchall()
    user_count = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    c.close()
    return {
        "total": total,
        "categories": {r["category"]: {"total": r["total"], "count": r["count"]} for r in cats},
        "recent": [dict(r) for r in recent],
        "user_count": user_count
    }

def add_chat(room, username, text):
    c = get_db()
    c.execute("INSERT INTO chat_messages (room,username,text,created_at) VALUES (?,?,?,?)",
              (room, username, text, time.time()))
    c.commit()
    c.close()
    record_earning("chat", EARN_PER_CHAT, f"Chat by {username}")

def get_chats(room):
    c = get_db()
    rows = c.execute("SELECT * FROM chat_messages WHERE room=? ORDER BY created_at DESC LIMIT 50", (room,)).fetchall()
    c.close()
    return [dict(r) for r in reversed(rows)]

def get_rooms():
    return [{"name": "General", "count": 0}, {"name": "Gaming", "count": 0}, {"name": "Vibes", "count": 0}]

def get_leaderboard():
    c = get_db()
    rows = c.execute("SELECT username,xp,premium FROM users ORDER BY xp DESC LIMIT 20").fetchall()
    c.close()
    return [dict(r) for r in rows]
