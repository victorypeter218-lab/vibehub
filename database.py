import sqlite3, hashlib, time
from config import DATABASE, ADMIN

DB_PATH = DATABASE

def get_db():
    return sqlite3.connect(DB_PATH)

def hash_pw(p):
    return hashlib.sha256(p.encode()).hexdigest()

def init_db():
    c = get_db()

    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        token TEXT,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        is_premium INTEGER DEFAULT 0,
        total_logins INTEGER DEFAULT 0,
        last_login REAL,
        created_at REAL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, content TEXT,
        media_type TEXT DEFAULT '', media_data TEXT DEFAULT '',
        created_at REAL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER, user_id INTEGER
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER, user_id INTEGER, text TEXT, created_at REAL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, friend_id INTEGER, status TEXT DEFAULT 'pending'
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at REAL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS room_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER, user_id INTEGER
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER, user_id INTEGER, text TEXT, created_at REAL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, description TEXT, icon TEXT, category TEXT,
        premium_only INTEGER DEFAULT 0, plays INTEGER DEFAULT 0
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS game_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER, user_id INTEGER, score INTEGER DEFAULT 0, created_at REAL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS admin_earnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT, amount REAL DEFAULT 0, user_id INTEGER,
        status TEXT DEFAULT 'available', created_at REAL
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, text TEXT, created_at REAL
    )""")

    # Seed admin if missing
    if not c.execute("SELECT id FROM users WHERE username=?", (ADMIN["username"],)).fetchone():
        c.execute("INSERT INTO users (username,password,display_name,token,level,xp,is_premium,total_logins,last_login,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                  (ADMIN["username"], hash_pw(ADMIN["default_password"]), "Admin", "", 99, 0, 1, 0, time.time(), time.time()))

    # ALWAYS force correct admin password (fixes old DB)
    c.execute("UPDATE users SET password=? WHERE username=?",
              (hash_pw(ADMIN["default_password"]), ADMIN["username"]))

    # Seed rooms
    if not c.execute("SELECT id FROM rooms").fetchone():
        for name in ["General", "Gaming", "Music", "Random"]:
            c.execute("INSERT INTO rooms (name,created_at) VALUES (?,?)", (name, time.time()))

    # Seed games
    if not c.execute("SELECT id FROM games").fetchone():
        games = [
            ("Subway Runner","Dodge obstacles","🏃","Arcade",0),
            ("Candy Match","Match 3 candies","🍬","Puzzle",0),
            ("Block Breaker","Break all bricks","🧱","Arcade",0),
            ("Snake Classic","Eat and grow","🐍","Arcade",0),
            ("Flappy Jump","Fly through pipes","🐦","Action",0),
            ("Memory Cards","Find pairs","🃏","Puzzle",0),
            ("Tic Tac Toe","Beat the AI","❌","Brain",0),
            ("2048","Slide and merge","🔢","Puzzle",0),
            ("Whack a Mole","Hit the moles","🔨","Arcade",0),
            ("Color Match","Match the color","🎨","Brain",0),
            ("Math Sprint","Solve fast","➕","Brain",0),
            ("Reaction Time","Tap when green","⚡","Action",0),
            ("Bubble Pop","Pop bubbles","🫧","Arcade",0),
            ("Fruit Slash","Slash fruits","🍉","Action",0),
            ("Piano Tiles","Tap black tiles","🎹","Arcade",0),
            ("Space Shooter","Shoot aliens","🚀","Action",1),
            ("Brick Smash","Smash all bricks","💥","Arcade",1),
            ("Word Search","Find hidden words","🔤","Puzzle",1),
            ("Quiz Royale","Answer trivia","❓","Brain",1),
            ("Slot Machine","Spin and win","🎰","Casino",1),
            ("Lucky Dice","Roll the dice","🎲","Casino",1),
            ("Tower Stack","Stack blocks","🏗️","Arcade",1),
            ("Maze Escape","Find the exit","🌀","Puzzle",1),
        ]
        for g in games:
            c.execute("INSERT INTO games (name,description,icon,category,premium_only,plays) VALUES (?,?,?,?,?,0)", g)

    c.commit()
    c.close()
    print("  ✅  Database ready — admin password reset to: " + ADMIN["default_password"])