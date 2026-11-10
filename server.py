from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import hashlib, secrets, time, sqlite3, os
from config import *
from database import get_db, init_db

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# ── helpers ──────────────────────────────────────────────
def hash_pw(p):
    return hashlib.sha256(p.encode()).hexdigest()

def db():
    c = get_db()
    c.row_factory = sqlite3.Row
    return c

def auth(f):
    from functools import wraps
    @wraps(f)
    def wrap(*a, **kw):
        tk = request.headers.get('Authorization', '').replace('Bearer ', '')
        u = db().execute("SELECT * FROM users WHERE token=?", (tk,)).fetchone()
        if not u:
            return jsonify(error="Unauthorized"), 401
        request.user = u
        return f(*a, **kw)
    return wrap

def earn(source, amount, uid=None):
    d = db()
    d.execute("INSERT INTO admin_earnings(source,amount,user_id,status,created_at) VALUES(?,?,?,?,?)",
              (source, amount, uid, 'available', time.time()))
    d.commit()

def add_xp(uid, n):
    d = db()
    d.execute("UPDATE users SET xp=xp+? WHERE id=?", (n, uid))
    r = d.execute("SELECT xp,level FROM users WHERE id=?", (uid,)).fetchone()
    nl = r['xp'] // 1000 + 1
    if nl > r['level']:
        d.execute("UPDATE users SET level=? WHERE id=?", (nl, uid))
    d.commit()

def user_dict(u):
    return dict(id=u['id'], username=u['username'], display_name=u['display_name'],
                level=u['level'], xp=u['xp'], is_premium=u['is_premium'],
                is_admin=(u['username'] == ADMIN['username']))

# ── static files ─────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:f>')
def statics(f):
    if f.endswith(('.css', '.js', '.png', '.jpg', '.ico')):
        return send_from_directory('.', f)
    return 'Not found', 404

# ── auth ─────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    d = request.json or {}
    un = d.get('username', '').strip().lower()
    pw = d.get('password', '')
    dn = d.get('display_name', un)
    if not un or not pw:
        return jsonify(error="Username & password required"), 400
    c = db()
    if c.execute("SELECT id FROM users WHERE username=?", (un,)).fetchone():
        return jsonify(error="Username taken"), 400
    tk = secrets.token_hex(32)
    c.execute("INSERT INTO users(username,password,display_name,token,level,xp,is_premium,total_logins,last_login,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
              (un, hash_pw(pw), dn, tk, 1, 0, 0, 1, time.time(), time.time()))
    c.commit()
    uid = c.execute("SELECT id FROM users WHERE username=?", (un,)).fetchone()['id']
    earn('signup', EARN_PER_SIGNUP, uid)
    add_xp(uid, 50)
    u = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return jsonify(token=tk, user=user_dict(u))

@app.route('/api/login', methods=['POST'])
def login():
    d = request.json or {}
    un = d.get('username', '').strip().lower()
    pw = d.get('password', '')
    c = db()
    u = c.execute("SELECT * FROM users WHERE username=? AND password=?", (un, hash_pw(pw))).fetchone()
    if not u:
        return jsonify(error="Invalid credentials"), 401
    tk = secrets.token_hex(32)
    c.execute("UPDATE users SET token=?,total_logins=total_logins+1,last_login=? WHERE id=?",
              (tk, time.time(), u['id']))
    c.commit()
    earn('login', EARN_PER_LOGIN, u['id'])
    add_xp(u['id'], 20)
    u2 = c.execute("SELECT * FROM users WHERE id=?", (u['id'],)).fetchone()
    return jsonify(token=tk, user=user_dict(u2))

@app.route('/api/logout', methods=['POST'])
@auth
def logout():
    c = db()
    c.execute("UPDATE users SET token='' WHERE id=?", (request.user['id'],))
    c.commit()
    return jsonify(ok=True)

@app.route('/api/status')
@auth
def status():
    return jsonify(ok=True, user=user_dict(request.user))

# ── feed ─────────────────────────────────────────────────
@app.route('/api/posts')
@auth
def get_posts():
    c = db()
    rows = c.execute("""SELECT p.*, u.display_name, u.username,
                        (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) AS likes,
                        (SELECT COUNT(*) FROM comments WHERE post_id=p.id) AS cmt_count
                        FROM posts p JOIN users u ON p.user_id=u.id
                        ORDER BY p.created_at DESC LIMIT 50""").fetchall()
    posts = []
    for r in rows:
        p = dict(r)
        p['liked'] = bool(c.execute("SELECT id FROM post_likes WHERE post_id=? AND user_id=?",
                                     (r['id'], request.user['id'])).fetchone())
        posts.append(p)
    return jsonify(posts=posts)

@app.route('/api/posts/create', methods=['POST'])
@auth
def create_post():
    d = request.json or {}
    content = d.get('content', '').strip()
    if not content:
        return jsonify(error="Post cannot be empty"), 400
    c = db()
    c.execute("INSERT INTO posts(user_id,content,media_type,media_data,created_at) VALUES(?,?,?,?,?)",
              (request.user['id'], content, d.get('media_type', ''), d.get('media_data', ''), time.time()))
    c.commit()
    earn('post', EARN_PER_POST, request.user['id'])
    add_xp(request.user['id'], 15)
    return jsonify(ok=True)

@app.route('/api/posts/<int:pid>/like', methods=['POST'])
@auth
def like_post(pid):
    c = db()
    existing = c.execute("SELECT id FROM post_likes WHERE post_id=? AND user_id=?",
                         (pid, request.user['id'])).fetchone()
    if existing:
        c.execute("DELETE FROM post_likes WHERE id=?", (existing['id'],))
    else:
        c.execute("INSERT INTO post_likes(post_id,user_id) VALUES(?,?)", (pid, request.user['id']))
    c.commit()
    cnt = c.execute("SELECT COUNT(*) AS c FROM post_likes WHERE post_id=?", (pid,)).fetchone()['c']
    return jsonify(likes=cnt, liked=not bool(existing))

@app.route('/api/posts/<int:pid>/comments')
@auth
def get_comments(pid):
    c = db()
    rows = c.execute("SELECT cm.*, u.display_name FROM comments cm JOIN users u ON cm.user_id=u.id WHERE cm.post_id=? ORDER BY cm.created_at", (pid,)).fetchall()
    return jsonify(comments=[dict(r) for r in rows])

@app.route('/api/posts/<int:pid>/comment', methods=['POST'])
@auth
def add_comment(pid):
    d = request.json or {}
    txt = d.get('text', '').strip()
    if not txt:
        return jsonify(error="Empty comment"), 400
    c = db()
    c.execute("INSERT INTO comments(post_id,user_id,text,created_at) VALUES(?,?,?,?)",
              (pid, request.user['id'], txt, time.time()))
    c.commit()
    earn('chat', EARN_PER_CHAT, request.user['id'])
    return jsonify(ok=True)

# ── friends ──────────────────────────────────────────────
@app.route('/api/friends/<int:uid>')
@auth
def get_friends(uid):
    c = db()
    rows = c.execute("""SELECT u.id, u.username, u.display_name, f.status, f.id AS fid
                        FROM friends f JOIN users u ON (
                          CASE WHEN f.user_id=? THEN f.friend_id ELSE f.user_id END = u.id
                        ) WHERE (f.user_id=? OR f.friend_id=?) """, (uid, uid, uid)).fetchall()
    return jsonify(friends=[dict(r) for r in rows])

@app.route('/api/friends/add', methods=['POST'])
@auth
def add_friend():
    d = request.json or {}
    fid = d.get('friend_id')
    if fid == request.user['id']:
        return jsonify(error="Cannot add yourself"), 400
    c = db()
    if c.execute("SELECT id FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)",
                 (request.user['id'], fid, fid, request.user['id'])).fetchone():
        return jsonify(error="Already friends or pending"), 400
    c.execute("INSERT INTO friends(user_id,friend_id,status) VALUES(?,?,?)",
              (request.user['id'], fid, 'pending'))
    c.commit()
    return jsonify(ok=True)

@app.route('/api/friends/accept', methods=['POST'])
@auth
def accept_friend():
    d = request.json or {}
    fid = d.get('friend_id')
    c = db()
    c.execute("UPDATE friends SET status='accepted' WHERE id=? AND friend_id=?",
              (fid, request.user['id']))
    c.commit()
    return jsonify(ok=True)

# ── chat ─────────────────────────────────────────────────
@app.route('/api/rooms')
@auth
def get_rooms():
    c = db()
    rows = c.execute("SELECT r.*, (SELECT COUNT(*) FROM room_members WHERE room_id=r.id) AS members FROM rooms r ORDER BY r.created_at").fetchall()
    return jsonify(rooms=[dict(r) for r in rows])

@app.route('/api/rooms/create', methods=['POST'])
@auth
def create_room():
    d = request.json or {}
    name = d.get('name', '').strip()
    if not name:
        return jsonify(error="Name required"), 400
    c = db()
    c.execute("INSERT INTO rooms(name,created_at) VALUES(?,?)", (name, time.time()))
    c.commit()
    rid = c.execute("SELECT last_insert_rowid() AS id").fetchone()['id']
    c.execute("INSERT INTO room_members(room_id,user_id) VALUES(?,?)", (rid, request.user['id']))
    c.commit()
    return jsonify(ok=True, room_id=rid)

@app.route('/api/rooms/<int:rid>/join', methods=['POST'])
@auth
def join_room(rid):
    c = db()
    if not c.execute("SELECT id FROM room_members WHERE room_id=? AND user_id=?", (rid, request.user['id'])).fetchone():
        c.execute("INSERT INTO room_members(room_id,user_id) VALUES(?,?)", (rid, request.user['id']))
        c.commit()
    return jsonify(ok=True)

@app.route('/api/rooms/<int:rid>/messages')
@auth
def get_messages(rid):
    c = db()
    rows = c.execute("SELECT m.*, u.display_name, u.username FROM messages m JOIN users u ON m.user_id=u.id WHERE m.room_id=? ORDER BY m.created_at DESC LIMIT 100", (rid,)).fetchall()
    return jsonify(messages=[dict(r) for r in reversed(rows)])

@app.route('/api/rooms/<int:rid>/send', methods=['POST'])
@auth
def send_msg(rid):
    d = request.json or {}
    txt = d.get('text', '').strip()
    if not txt:
        return jsonify(error="Empty message"), 400
    c = db()
    c.execute("INSERT INTO messages(room_id,user_id,text,created_at) VALUES(?,?,?,?)",
              (rid, request.user['id'], txt, time.time()))
    c.commit()
    earn('chat', EARN_PER_CHAT, request.user['id'])
    add_xp(request.user['id'], 5)
    return jsonify(ok=True)

# ── games ────────────────────────────────────────────────
@app.route('/api/games')
@auth
def get_games():
    c = db()
    rows = c.execute("SELECT * FROM games ORDER BY id").fetchall()
    return jsonify(games=[dict(r) for r in rows])

@app.route('/api/games/score', methods=['POST'])
@auth
def game_score():
    d = request.json or {}
    gid = d.get('game_id')
    score = d.get('score', 0)
    c = db()
    g = c.execute("SELECT * FROM games WHERE id=?", (gid,)).fetchone()
    if not g:
        return jsonify(error="Game not found"), 404
    if g['premium_only'] and not request.user['is_premium']:
        return jsonify(error="Premium required"), 403
    c.execute("INSERT INTO game_scores(game_id,user_id,score,created_at) VALUES(?,?,?,?)",
              (gid, request.user['id'], score, time.time()))
    c.execute("UPDATE games SET plays=plays+1 WHERE id=?", (gid,))
    c.commit()
    earn('game', EARN_PER_GAME, request.user['id'])
    add_xp(request.user['id'], 30)
    return jsonify(ok=True)

@app.route('/api/leaderboard')
@auth
def leaderboard():
    c = db()
    rows = c.execute("""SELECT u.display_name, u.username, u.level, u.xp, u.is_premium,
                        (SELECT COALESCE(MAX(score),0) FROM game_scores WHERE user_id=u.id) AS best
                        FROM users u ORDER BY u.xp DESC LIMIT 50""").fetchall()
    return jsonify(leaderboard=[dict(r) for r in rows])

# ── notifications ────────────────────────────────────────
@app.route('/api/notifications/<int:uid>')
@auth
def get_notifs(uid):
    c = db()
    rows = c.execute("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30", (uid,)).fetchall()
    return jsonify(notifications=[dict(r) for r in rows])

# ── premium ──────────────────────────────────────────────
@app.route('/api/premium/init', methods=['POST'])
@auth
def premium_init():
    c = db()
    if request.user['is_premium']:
        return jsonify(error="Already premium"), 400
    c.execute("UPDATE users SET is_premium=1 WHERE id=?", (request.user['id'],))
    c.commit()
    earn('premium', PREMIUM_PRICE, request.user['id'])
    return jsonify(ok=True)

# ── admin ────────────────────────────────────────────────
@app.route('/api/admin/stats')
@auth
def admin_stats():
    if request.user['username'] != ADMIN['username']:
        return jsonify(error="Forbidden"), 403
    c = db()
    total = c.execute("SELECT COALESCE(SUM(amount),0) AS s FROM admin_earnings").fetchone()['s']
    avail = c.execute("SELECT COALESCE(SUM(amount),0) AS s FROM admin_earnings WHERE status='available'").fetchone()['s']
    today_start = time.time() - 86400
    today = c.execute("SELECT COALESCE(SUM(amount),0) AS s FROM admin_earnings WHERE created_at>?", (today_start,)).fetchone()['s']
    users = c.execute("SELECT COUNT(*) AS c FROM users").fetchone()['c']
    breakdown = {}
    for row in c.execute("SELECT source, SUM(amount) AS s FROM admin_earnings GROUP BY source").fetchall():
        breakdown[row['source']] = row['s']
    return jsonify(total=total, available=avail, today=today, users=users, breakdown=breakdown)

@app.route('/api/admin/users')
@auth
def admin_users():
    if request.user['username'] != ADMIN['username']:
        return jsonify(error="Forbidden"), 403
    c = db()
    rows = c.execute("SELECT id,username,display_name,level,xp,is_premium,total_logins,last_login,created_at FROM users ORDER BY created_at DESC").fetchall()
    return jsonify(users=[dict(r) for r in rows])

@app.route('/api/admin/withdraw', methods=['POST'])
@auth
def admin_withdraw():
    if request.user['username'] != ADMIN['username']:
        return jsonify(error="Forbidden"), 403
    d = request.json or {}
    amt = d.get('amount', 0)
    c = db()
    avail = c.execute("SELECT COALESCE(SUM(amount),0) AS s FROM admin_earnings WHERE status='available'").fetchone()['s']
    if amt <= 0 or amt > avail:
        return jsonify(error="Invalid amount"), 400
    c.execute("UPDATE admin_earnings SET status='withdrawn' WHERE status='available'")
    c.commit()
    return jsonify(ok=True, withdrawn=amt, bank=ADMIN['bank'], account=ADMIN['account_number'])

# ── run ──────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print(f"\n  🎮  Vibe Hub running at http://localhost:{PORT}\n")
    app.run(host=HOST, port=PORT, debug=DEBUG)