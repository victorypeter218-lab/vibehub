import os, time, jwt
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from config import *
from database import *

app = Flask(__name__, static_folder='.')
CORS(app)
init_db()

def auth(req):
    t = req.headers.get("Authorization", "").replace("Bearer ", "")
    if not t: return None
    try:
        d = jwt.decode(t, SECRET_KEY, algorithms=["HS256"])
        return get_user(d["uid"])
    except:
        return None

def make_token(uid):
    return jwt.encode({"uid": uid, "exp": time.time() + 86400 * 30}, SECRET_KEY, algorithm="HS256")

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:f>")
def static_files(f):
    return send_from_directory(".", f)

@app.route("/api/register", methods=["POST"])
def register():
    d = request.json
    if not d or not d.get("username") or not d.get("email") or not d.get("password"):
        return jsonify({"error": "All fields required"})
    uid = create_user(d["username"].strip(), d["email"].strip(), d["password"])
    if not uid:
        return jsonify({"error": "Username or email taken"})
    return jsonify({"token": make_token(uid)})

@app.route("/api/login", methods=["POST"])
def login():
    d = request.json
    if not d: return jsonify({"error": "No data"})
    u = login_user(d.get("username", ""), d.get("password", ""))
    if not u: return jsonify({"error": "Wrong credentials"})
    return jsonify({"token": make_token(u["id"])})

@app.route("/api/status")
def status():
    u = auth(request)
    if not u: return jsonify({"error": "Not logged in"})
    return jsonify({"username": u["username"], "coins": u["coins"], "xp": u["xp"],
                    "premium": u["premium"] or u["is_admin"], "is_admin": u["is_admin"]})

@app.route("/api/feed")
def feed():
    posts = get_posts()
    for p in posts:
        age = time.time() - p["created_at"]
        if age < 60: p["time"] = "just now"
        elif age < 3600: p["time"] = f"{int(age/60)}m ago"
        elif age < 86400: p["time"] = f"{int(age/3600)}h ago"
        else: p["time"] = f"{int(age/86400)}d ago"
    return jsonify({"posts": posts})

@app.route("/api/post", methods=["POST"])
def post():
    u = auth(request)
    if not u: return jsonify({"error": "Login first"})
    d = request.json
    text = d.get("text", "").strip()
    image = d.get("image", "")
    if not text and not image: return jsonify({"error": "Write something"})
    create_post(u["id"], u["username"], text, image)
    return jsonify({"success": True})

@app.route("/api/chat/rooms")
def rooms():
    return jsonify({"rooms": get_rooms()})

@app.route("/api/chat/messages")
def messages():
    room = request.args.get("room", "General")
    return jsonify({"messages": get_chats(room)})

@app.route("/api/chat/send", methods=["POST"])
def send_chat():
    u = auth(request)
    if not u: return jsonify({"error": "Login first"})
    d = request.json
    add_chat(d.get("room", "General"), u["username"], d.get("text", ""))
    return jsonify({"success": True})

@app.route("/api/game/play", methods=["POST"])
def game_play():
    u = auth(request)
    if not u: return jsonify({"error": "Login first"})
    record_earning("game", EARN_PER_GAME, f"Game by {u['username']}")
    return jsonify({"success": True})

@app.route("/api/leaderboard")
def leaderboard():
    return jsonify({"users": get_leaderboard()})

@app.route("/api/profile")
def profile():
    u = auth(request)
    if not u: return jsonify({"error": "Login first"})
    return jsonify({"username": u["username"], "coins": u["coins"], "xp": u["xp"],
                    "premium": u["premium"] or u["is_admin"]})

@app.route("/api/premium", methods=["POST"])
def premium():
    u = auth(request)
    if not u: return jsonify({"error": "Login first"})
    if u["premium"]: return jsonify({"error": "Already premium"})
    c = get_db()
    c.execute("UPDATE users SET premium=1 WHERE id=?", (u["id"],))
    c.commit()
    c.close()
    record_earning("premium", PREMIUM_PRICE, f"Premium: {u['username']}")
    return jsonify({"success": True})

@app.route("/api/admin/stats")
def admin_stats():
    u = auth(request)
    if not u or not u["is_admin"]: return jsonify({"error": "Admin only"})
    data = get_earnings_breakdown()
    cats = data["categories"]
    return jsonify({
        "total": data["total"],
        "signup_earn": cats.get("signup", {}).get("total", 0),
        "signup_count": cats.get("signup", {}).get("count", 0),
        "login_earn": cats.get("login", {}).get("total", 0),
        "login_count": cats.get("login", {}).get("count", 0),
        "post_earn": cats.get("post", {}).get("total", 0),
        "game_earn": cats.get("game", {}).get("total", 0),
        "chat_earn": cats.get("chat", {}).get("total", 0),
        "premium_earn": cats.get("premium", {}).get("total", 0),
        "user_count": data["user_count"]
    })

@app.route("/api/admin/users")
def admin_users():
    u = auth(request)
    if not u or not u["is_admin"]: return jsonify({"error": "Admin only"})
    return jsonify({"users": get_all_users()})

@app.route("/api/admin/transactions")
def admin_transactions():
    u = auth(request)
    if not u or not u["is_admin"]: return jsonify({"error": "Admin only"})
    data = get_earnings_breakdown()
    for t in data["recent"]:
        age = time.time() - t["created_at"]
        if age < 60: t["time"] = "just now"
        elif age < 3600: t["time"] = f"{int(age/60)}m ago"
        elif age < 86400: t["time"] = f"{int(age/3600)}h ago"
        else: t["time"] = f"{int(age/86400)}d ago"
    return jsonify({"transactions": data["recent"]})

@app.route("/api/admin/withdraw", methods=["POST"])
def withdraw():
    u = auth(request)
    if not u or not u["is_admin"]: return jsonify({"error": "Admin only"})
    d = request.json
    amt = d.get("amount", 0)
    return jsonify({"success": True, "message": f"₦{amt:,.0f} withdrawal to {ADMIN['bank']} ({ADMIN['account_number']}) processing"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
