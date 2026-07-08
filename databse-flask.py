# server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
from dbutils.pooled_db import PooledDB
import os, json, re, time
from werkzeug.utils import secure_filename
from datetime import datetime
# This file is  ran on my pc and act as an api for mariadb running on my own pc
# The access ip is db.7fun7-api.online
import random
from datetime import datetime, timedelta
import pytz
import uuid

app = Flask(__name__)
CORS(app)



UPLOAD_DIR = "public/images/logos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DB_POOL = None


def load_settings():
    with open("setting.json", "r", encoding="utf-8") as f:
        return json.load(f)

def db():
    global DB_POOL

    if DB_POOL is None:
        print("Creating PyMySQL pool...")

        DB_POOL = PooledDB(
            creator=pymysql,
            maxconnections=20,
            mincached=1,
            maxcached=5,
            blocking=True,
            host="127.0.0.1",
            port=3307,
            user="python_user",
            password="Ubet889",
            database="u297159044_7fun7s",
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
        )

        print("Pool created successfully")

    print("Getting connection from pool...")
    return DB_POOL.connection()

def rows(cursor):
    return cursor.fetchall()


def safe_username(value):
    return re.sub(r"[^a-zA-Z0-9_-]", "", value or "").lower()


def json_text(value, default=None):
    if default is None:
        default = []
    return json.dumps(value if value is not None else default, ensure_ascii=False)


def decode_json(value, default=None):
    if default is None:
        default = []
    try:
        return json.loads(value) if value else default
    except Exception:
        return default

@app.before_request
def log_request():
    print(
        f"[{datetime.now()}] "
        f"{request.method} "
        f"{request.full_path} "
        f"IP={request.remote_addr}"
    )
@app.route("/health")
def health():
    return jsonify({"ok": True})

@app.route("/api", methods=["GET", "POST", "PUT", "OPTIONS"])
def api():
    if request.method == "OPTIONS":
        return "", 204

    api_type = request.args.get("type", "")
    action = request.args.get("action", "get")

    if api_type == "setup":
        return setup_tables()

    if api_type == "matches":
        return matches_api(action)

    if api_type == "user":
        return user_api(action)

    if api_type == "betslips":
        return betslips_api(action)

    if api_type == "transactions":
        return transactions_api(action)

    if api_type == "admin":
        return admin_api(action)

    if api_type == "stats":
        return stats_api(action)

    if api_type == "slot":
        return slot_api(action)

    if api_type == "champion":
        return champion_api(action)

    if api_type == "deposit_progress":
        return deposit_progress_api(action)

    return jsonify({"error": "Invalid type", "type": api_type}), 400


def setup_tables():
    conn = db()
    print("Setup database finished")
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id VARCHAR(255) PRIMARY KEY,
            team1 VARCHAR(255),
            team2 VARCHAR(255),
            league VARCHAR(255),
            timeText VARCHAR(255),
            line DECIMAL(10,2) DEFAULT 0,
            hdpLine DECIMAL(10,2) DEFAULT 0,
            payoutWinnerTeam1 DECIMAL(10,2) DEFAULT 0,
            payoutWinnerTeam2 DECIMAL(10,2) DEFAULT 0,
            payoutDraw DECIMAL(10,2) DEFAULT 0,
            payoutOver DECIMAL(10,2) DEFAULT 0,
            payoutUnder DECIMAL(10,2) DEFAULT 0,
            payoutTotal DECIMAL(10,2) DEFAULT 0,
            payoutHdp1 DECIMAL(10,2) DEFAULT 0,
            payoutHdp2 DECIMAL(10,2) DEFAULT 0,
            rewardAmount DECIMAL(15,2) DEFAULT 0,
            awarded TINYINT(1) DEFAULT 0,
            winner VARCHAR(255),
            visibility TINYINT(1) DEFAULT 1,
            commence_time DATETIME NULL,
            sport_key VARCHAR(255),
            home_team VARCHAR(255),
            away_team VARCHAR(255),
            team1_logo VARCHAR(500),
            team2_logo VARCHAR(500),
            raw_json LONGTEXT,
            finalScore1 INT DEFAULT NULL,
            finalScore2 INT DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS members (
            username VARCHAR(255) PRIMARY KEY,
            tts VARCHAR(255),
            total_deposit FLOAT DEFAULT 0,
            balance DECIMAL(15,2) DEFAULT 0,
            promotion_balance DECIMAL(15,2) DEFAULT 0,
            spinsLeft INT DEFAULT 0,
            football_guess INT DEFAULT 5,
            Get_monthly_reward TINYINT(1) DEFAULT 0,
            Claimed_Monthly TINYINT(1) DEFAULT 0,
            last_reset VARCHAR(50),
            lastSpinDate VARCHAR(50),
            isBlacklisted TINYINT(1) DEFAULT 0,
            payout_rate DECIMAL(5,2) DEFAULT 1.0,
            dailyFootballLimit INT DEFAULT 5,
            lastFootballDate VARCHAR(50),
            history LONGTEXT,
            predictions LONGTEXT,
            exchanges LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS betslips (
            id INT AUTO_INCREMENT PRIMARY KEY,
            receipt_id VARCHAR(50) UNIQUE NOT NULL,
            username VARCHAR(255) NOT NULL,
            bet_amount DECIMAL(15,2) DEFAULT 0,
            total_odd DECIMAL(15,2) DEFAULT 1.0,
            match_quantity INT DEFAULT 0,
            matches_json LONGTEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'ACCEPTED',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            username VARCHAR(255) PRIMARY KEY,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'agent',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        INSERT IGNORE INTO admins (username, password, role)
        VALUES ('teb', 'aaaa9999', 'superadmin')
    """)

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True, "message": "Tables ready"})


def normalize_match(m):
    for key in [
        "line", "hdpLine", "payoutWinnerTeam1", "payoutWinnerTeam2",
        "payoutDraw", "payoutOver", "payoutUnder", "payoutTotal",
        "payoutHdp1", "payoutHdp2", "rewardAmount"
    ]:
        m[key] = float(m.get(key) or 0)

    m["awarded"] = bool(m.get("awarded"))
    m["visibility"] = bool(m.get("visibility"))
    m["team1"] = m.get("team1") or m.get("home_team") or ""
    m["team2"] = m.get("team2") or m.get("away_team") or ""
    m["league"] = m.get("league") or m.get("sport_key") or ""
    m["timeText"] = str(m.get("timeText") or m.get("commence_time") or "")

    return m


def matches_api(action):
    conn = db()
    
    print("Setup database finished")
    cur = conn.cursor()

    try:
        if action in ["get", "get_all"]:
            where = "WHERE visibility = 1" if action == "get" else ""

            cur.execute(f"""
                SELECT id, team1, team2, league, timeText,
                    line, hdpLine,
                    payoutWinnerTeam1, payoutWinnerTeam2, payoutDraw,
                    payoutOver, payoutUnder, payoutTotal,
                    payoutHdp1, payoutHdp2,
                    rewardAmount, awarded, winner, visibility,
                    commence_time, sport_key, home_team, away_team,
                    team1_logo, team2_logo
                FROM matches
                {where}
                ORDER BY commence_time ASC, sport_key ASC
            """)

            return jsonify([normalize_match(m) for m in rows(cur)])

        if action == "toggle_visibility":
            data = request.get_json(force=True)
            cur.execute(
                "UPDATE matches SET visibility=%s WHERE id=%s",
                (1 if data.get("visibility") else 0, data.get("id"))
            )
            conn.commit()
            return jsonify({"success": True})

        if action == "upload_logo":
            file = request.files.get("logo")
            match_id = request.form.get("matchId")
            team = int(request.form.get("team", 0))

            if not file or not match_id or team not in [1, 2]:
                return jsonify({"error": "Missing logo, matchId, or team"}), 400

            ext = file.filename.rsplit(".", 1)[-1].lower()
            if ext not in ["png", "jpg", "jpeg", "webp", "gif"]:
                return jsonify({"error": "Invalid file type"}), 400

            safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", match_id)
            filename = secure_filename(f"match_{safe_id}_team{team}_{int(time.time())}.{ext}")
            path = os.path.join(UPLOAD_DIR, filename)
            file.save(path)

            logo_url = f"/public/images/logos/{filename}"
            column = "team1_logo" if team == 1 else "team2_logo"

            cur.execute(f"UPDATE matches SET {column}=%s WHERE id=%s", (logo_url, match_id))
            conn.commit()

            return jsonify({"success": True, "logoUrl": logo_url})

        if action in ["save", "save_single"]:
            data = request.get_json(force=True)
            match_list = data if isinstance(data, list) else [data]

            sql = """
                INSERT INTO matches (
                    id, team1, team2, league, timeText, line,
                    payoutWinnerTeam1, payoutWinnerTeam2, payoutDraw,
                    payoutOver, payoutUnder, payoutTotal,
                    payoutHdp1, payoutHdp2, hdpLine,
                    rewardAmount, awarded, winner,
                    commence_time, sport_key, home_team, away_team,
                    team1_logo, team2_logo, raw_json,
                    finalScore1, finalScore2
                ) VALUES (
                    %(id)s, %(team1)s, %(team2)s, %(league)s, %(timeText)s, %(line)s,
                    %(payoutWinnerTeam1)s, %(payoutWinnerTeam2)s, %(payoutDraw)s,
                    %(payoutOver)s, %(payoutUnder)s, %(payoutTotal)s,
                    %(payoutHdp1)s, %(payoutHdp2)s, %(hdpLine)s,
                    %(rewardAmount)s, %(awarded)s, %(winner)s,
                    %(commence_time)s, %(sport_key)s, %(home_team)s, %(away_team)s,
                    %(team1_logo)s, %(team2_logo)s, %(raw_json)s,
                    %(finalScore1)s, %(finalScore2)s
                )
                ON DUPLICATE KEY UPDATE
                    team1=VALUES(team1),
                    team2=VALUES(team2),
                    league=VALUES(league),
                    timeText=VALUES(timeText),
                    line=VALUES(line),
                    payoutWinnerTeam1=VALUES(payoutWinnerTeam1),
                    payoutWinnerTeam2=VALUES(payoutWinnerTeam2),
                    payoutDraw=VALUES(payoutDraw),
                    payoutOver=VALUES(payoutOver),
                    payoutUnder=VALUES(payoutUnder),
                    payoutTotal=VALUES(payoutTotal),
                    payoutHdp1=VALUES(payoutHdp1),
                    payoutHdp2=VALUES(payoutHdp2),
                    hdpLine=VALUES(hdpLine),
                    rewardAmount=VALUES(rewardAmount),
                    awarded=VALUES(awarded),
                    winner=VALUES(winner),
                    commence_time=VALUES(commence_time),
                    sport_key=VALUES(sport_key),
                    home_team=VALUES(home_team),
                    away_team=VALUES(away_team),
                    team1_logo=VALUES(team1_logo),
                    team2_logo=VALUES(team2_logo),
                    raw_json=VALUES(raw_json),
                    finalScore1=VALUES(finalScore1),
                    finalScore2=VALUES(finalScore2)
            """

            for m in match_list:
                raw = m.get("raw_json")
                m2 = {
                    "id": m.get("id"),
                    "team1": m.get("team1") or m.get("home_team") or "",
                    "team2": m.get("team2") or m.get("away_team") or "",
                    "league": m.get("league") or m.get("sport_key") or "",
                    "timeText": m.get("timeText") or "",
                    "line": m.get("line", 0),
                    "payoutWinnerTeam1": m.get("payoutWinnerTeam1", 0),
                    "payoutWinnerTeam2": m.get("payoutWinnerTeam2", 0),
                    "payoutDraw": m.get("payoutDraw", 0),
                    "payoutOver": m.get("payoutOver", 0),
                    "payoutUnder": m.get("payoutUnder", 0),
                    "payoutTotal": m.get("payoutTotal", 0),
                    "payoutHdp1": m.get("payoutHdp1", 0),
                    "payoutHdp2": m.get("payoutHdp2", 0),
                    "hdpLine": m.get("hdpLine", 0),
                    "rewardAmount": m.get("rewardAmount", 0),
                    "awarded": 1 if m.get("awarded") else 0,
                    "winner": m.get("winner"),
                    "commence_time": m.get("commence_time"),
                    "sport_key": m.get("sport_key"),
                    "home_team": m.get("home_team"),
                    "away_team": m.get("away_team"),
                    "team1_logo": m.get("team1_logo") or m.get("logo1"),
                    "team2_logo": m.get("team2_logo") or m.get("logo2"),
                    "raw_json": raw if isinstance(raw, str) else json_text(raw, None),
                    "finalScore1": m.get("finalScore1") or m.get("team1_score"),
                    "finalScore2": m.get("finalScore2") or m.get("team2_score"),
                }
                cur.execute(sql, m2)

            conn.commit()
            return jsonify({"success": True, "message": "Matches saved"})

        return jsonify({"error": "Invalid matches action"}), 400

    finally:
        cur.close()
        conn.close()


def user_api(action):
    conn = db()
    print("Setup database finished")
    cur = conn.cursor()
    username = safe_username(request.args.get("username", ""))

    try:
        if action == "get":
            if username:
                cur.execute("SELECT * FROM members WHERE username=%s", (username,))
                user = cur.fetchone()

                if not user:
                    return jsonify({"error": "User not found"}), 404

                user["history"] = decode_json(user.get("history"))
                user["predictions"] = decode_json(user.get("predictions"))
                user["exchanges"] = decode_json(user.get("exchanges"))
                
                user["balance"] = float(user.get("balance") or 0)
                user["promotion_balance"] = float(user.get("promotion_balance") or 0)
                user["total_deposit"] = float(user.get("total_deposit") or 0)
                user["spinsLeft"] = int(user.get("spinsLeft") or 0)
                
                user["football_guess"] = int(
                    user["football_guess"]
                    if user.get("football_guess") is not None
                    else 5
                )
                user["isBlacklisted"] = bool(user.get("isBlacklisted"))
                user["Get_monthly_reward"] = bool(user.get("Get_monthly_reward"))
                user["Claimed_Monthly"] = bool(user.get("Claimed_Monthly"))
                
                user["payoutRate"] = float(
                    user["payout_rate"]
                    if user.get("payout_rate") is not None
                    else 1.0
                )
                user["Deposit_progress"] = float(user.get("Deposit_progress") or 0)
                user["claimedDepositBonuses"] = decode_json(user.get("claimedDepositBonuses"), default=[])
                return jsonify(user)

            limit = int(request.args.get("limit", 50))
            offset = int(request.args.get("offset", 0))
            search = request.args.get("search", "")
            tts = request.args.get("tts", "")

            where = []
            params = []

            if tts and tts != "teb":
                where.append("tts=%s")
                params.append(tts)

            if search:
                where.append("username LIKE %s")
                params.append(f"%{search}%")

            where_sql = "WHERE " + " AND ".join(where) if where else ""

            cur.execute(f"SELECT COUNT(*) AS total FROM members {where_sql}", params)
            total = cur.fetchone()["total"]

            cur.execute(
                f"SELECT * FROM members {where_sql} ORDER BY username ASC LIMIT %s OFFSET %s",
                params + [limit, offset]
            )

            users = rows(cur)

            for u in users:
                u["history"] = decode_json(u.get("history"))
                u["predictions"] = decode_json(u.get("predictions"))
                u["exchanges"] = decode_json(u.get("exchanges"))
                u["balance"] = float(u.get("balance") or 0)
                u["promotion_balance"] = float(u.get("promotion_balance") or 0)

            return jsonify({"users": users, "total": int(total), "limit": limit, "offset": offset})

        if action == "save":
            data = request.get_json(force=True)

            if not username:
                return jsonify({"error": "Missing username"}), 400

            sql = """
                INSERT INTO members (
                    username, tts, balance, promotion_balance, total_deposit,
                    spinsLeft, football_guess, Get_monthly_reward,
                    Claimed_Monthly, last_reset, lastSpinDate,
                    isBlacklisted, payout_rate, dailyFootballLimit,
                    lastFootballDate, history, predictions, exchanges,
                    claimedDepositBonuses
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON DUPLICATE KEY UPDATE
                    tts=VALUES(tts),
                    balance=VALUES(balance),
                    promotion_balance=VALUES(promotion_balance),
                    total_deposit=VALUES(total_deposit),
                    spinsLeft=VALUES(spinsLeft),
                    football_guess=VALUES(football_guess),
                    Get_monthly_reward=VALUES(Get_monthly_reward),
                    Claimed_Monthly=VALUES(Claimed_Monthly),
                    last_reset=VALUES(last_reset),
                    lastSpinDate=VALUES(lastSpinDate),
                    isBlacklisted=VALUES(isBlacklisted),
                    payout_rate=VALUES(payout_rate),
                    dailyFootballLimit=VALUES(dailyFootballLimit),
                    lastFootballDate=VALUES(lastFootballDate),
                    history=VALUES(history),
                    predictions=VALUES(predictions),
                    exchanges=VALUES(exchanges),
                    claimedDepositBonuses=VALUES(claimedDepositBonuses)
            """
            # Note: Deposit_progress is intentionally NOT in the save — only
            # the scraper (7fun7.py) and deposit_progress_api add/set it,
            # so a regular user save never accidentally overwrites progress.

            cur.execute(sql, (
                username,
                data.get("tts", ""),
                data.get("balance", data.get("promotion_balance", 0)),
                data.get("promotion_balance", data.get("balance", 0)),
                data.get("total_deposit", 0),
                data.get("spinsLeft", 0),
                data.get("football_guess", 5),
                1 if data.get("Get_monthly_reward") else 0,
                1 if data.get("Claimed_Monthly") else 0,
                data.get("last_reset", ""),
                data.get("lastSpinDate", ""),
                1 if data.get("isBlacklisted") else 0,
                data.get("payoutRate", 1.0),
                data.get("dailyFootballLimit", 0),
                data.get("lastFootballDate", ""),
                json_text(data.get("history")),
                json_text(data.get("predictions")),
                json_text(data.get("exchanges")),
                json_text(data.get("claimedDepositBonuses", [])),
            ))

            conn.commit()
            return jsonify({"success": True, "message": "User saved"})

        return jsonify({"error": "Invalid user action"}), 400

    finally:
        cur.close()
        conn.close()


def betslips_api(action):
    conn = db()
    print("Setup database finished")
    cur = conn.cursor()

    try:
        if action == "save":
            data = request.get_json(force=True)

            username = safe_username(data.get("username"))
            match_quantity = int(data.get("match_quantity", 0))

            # -------------------------
            # CHECK USER
            # -------------------------
            cur.execute(
                "SELECT football_guess FROM members WHERE username=%s",
                (username,)
            )

            user = cur.fetchone()

            if not user:
                return jsonify({
                    "success": False,
                    "error": "User not found"
                }), 404

            football_guess = int(user.get("football_guess") or 0)

            # -------------------------
            # NOT ENOUGH GUESSES
            # -------------------------
            if football_guess < match_quantity:
                return jsonify({
                    "success": False,
                    "error": "Not enough football guesses",
                    "football_guess": football_guess,
                    "required": match_quantity
                }), 400

            # -------------------------
            # INSERT BETSLIP
            # -------------------------
            cur.execute("""
                INSERT INTO betslips
                (
                    receipt_id,
                    username,
                    bet_amount,
                    total_odd,
                    match_quantity,
                    matches_json,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                data.get("receipt_id"),
                username,
                data.get("bet_amount", 0),
                data.get("total_odd", 1),
                match_quantity,
                json_text(data.get("matches")),
                data.get("status", "ACCEPTED"),
            ))

            # -------------------------
            # DEDUCT FOOTBALL GUESSES
            # -------------------------
            cur.execute("""
                UPDATE members
                SET football_guess = football_guess - %s
                WHERE username = %s
            """, (
                match_quantity,
                username
            ))

            conn.commit()

            return jsonify({
                "success": True,
                "remaining_football_guess": football_guess - match_quantity
            })
        if action == "get":
            receipt_id = request.args.get("id", "")
            cur.execute("SELECT * FROM betslips WHERE receipt_id=%s", (receipt_id,))
            slip = cur.fetchone()
            if not slip:
                return jsonify({"error": "Receipt not found"}), 404

            slip["matches"] = decode_json(slip.get("matches_json"))
            slip["bet_amount"] = float(slip.get("bet_amount") or 0)
            slip["total_odd"] = float(slip.get("total_odd") or 1)
            return jsonify(slip)

        if action == "get_user":
            username = safe_username(request.args.get("username", ""))

            cur.execute(
                "SELECT * FROM betslips WHERE LOWER(username)=%s ORDER BY created_at DESC",
                (username,)
            )

            slips = rows(cur)
            for s in slips:
                s["matches"] = decode_json(s.get("matches_json"))
                s["bet_amount"] = float(s.get("bet_amount") or 0)
                s["total_odd"] = float(s.get("total_odd") or 1)

            return jsonify(slips)

        if action == "get_all":
            limit = int(request.args.get("limit", 50))
            offset = int(request.args.get("offset", 0))
            search = request.args.get("search", "")
            tts = request.args.get("tts", "")

            where_clauses = []
            params = []

            if search:
                where_clauses.append("(b.username LIKE %s OR b.receipt_id LIKE %s)")
                params.extend([f"%{search}%", f"%{search}%"])

            if tts and tts != 'teb':
                where_clauses.append("m.tts = %s")
                params.append(tts)

            where = ""
            join = ""
            if tts and tts != 'teb':
                join = "JOIN members m ON b.username = m.username"

            if where_clauses:
                where = "WHERE " + " AND ".join(where_clauses)

            cur.execute(f"SELECT COUNT(*) AS total FROM betslips b {join} {where}", params)
            total = cur.fetchone()["total"]

            cur.execute(
                f"SELECT b.* FROM betslips b {join} {where} ORDER BY b.created_at DESC LIMIT %s OFFSET %s",
                params + [limit, offset]
            )

            slips = rows(cur)
            for s in slips:
                s["matches"] = decode_json(s.get("matches_json"))
                s["bet_amount"] = float(s.get("bet_amount") or 0)
                s["total_odd"] = float(s.get("total_odd") or 1)

            return jsonify({"betslips": slips, "total": int(total), "limit": limit, "offset": offset})

        if action == "update_status":

            try:
                data = request.get_json(force=True)

                print("\n=== UPDATE BETSLIP REQUEST ===")
                print(json.dumps(data, indent=2, default=str))

                receipt_id = data.get("receipt_id")
                status = data.get("status")

                if not receipt_id:
                    return jsonify({
                        "success": False,
                        "error": "Missing receipt_id"
                    }), 400

                # Update status + matches
                if "matches" in data:

                    matches_json = json.dumps(
                        data.get("matches"),
                        ensure_ascii=False,
                        default=str
                    )

                    print("\nMATCHES JSON LENGTH:", len(matches_json))

                    cur.execute(
                        """
                        UPDATE betslips
                        SET status=%s, matches_json=%s
                        WHERE receipt_id=%s
                        """,
                        (
                            status,
                            matches_json,
                            receipt_id
                        )
                    )

                # Update only status
                else:

                    cur.execute(
                        """
                        UPDATE betslips
                        SET status=%s
                        WHERE receipt_id=%s
                        """,
                        (
                            status,
                            receipt_id
                        )
                    )

                conn.commit()

                print("\nBETSLIP UPDATED SUCCESSFULLY")

                return jsonify({
                    "success": True,
                    "receipt_id": receipt_id,
                    "status": status
                })

            except Exception as e:

                print("\n=== UPDATE BETSLIP ERROR ===")
                print(str(e))

                return jsonify({
                    "success": False,
                    "error": str(e)
                }), 500

        return jsonify({"error": "Invalid betslips action"}), 400

    finally:
        cur.close()
        conn.close()


def transactions_api(action):
    if action != "get":
        return jsonify({"error": "Invalid transactions action"}), 400

    conn = db()
    print("Setup database finished")
    cur = conn.cursor()

    try:
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
        search = request.args.get("search", "").lower()
        tts = request.args.get("tts", "")

        where = "WHERE exchanges IS NOT NULL AND exchanges != '[]'"
        params = []

        if tts and tts != "teb":
            where += " AND tts=%s"
            params.append(tts)

        cur.execute(f"SELECT username, exchanges FROM members {where}", params)

        transactions = []

        for row in rows(cur):
            for ex in decode_json(row.get("exchanges")):
                ex["username"] = row["username"]

                if search:
                    target = f"{ex.get('username', '')} {ex.get('id', '')}".lower()
                    if search not in target:
                        continue

                transactions.append(ex)

        transactions.sort(key=lambda x: x.get("date", ""), reverse=True)

        return jsonify({
            "transactions": transactions[offset:offset + limit],
            "total": len(transactions),
            "limit": limit,
            "offset": offset
        })

    finally:
        cur.close()
        conn.close()



















def stats_api(action):
    if action != "get":
        return jsonify({"error": "Invalid stats action"}), 400

    conn = db()
    cur = conn.cursor()

    try:
        # ── ensure column exists ─────────────────────────────
        try:
            cur.execute("""
                ALTER TABLE members
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            """)
            conn.commit()
        except Exception:
            conn.rollback()

        tts = request.args.get("tts", "")
        from_date = request.args.get("from_date", "")
        to_date = request.args.get("to_date", "")

        # ── +1 DAY SHIFT (your requirement) ──────────────────
        if from_date:
            from_date = (
                datetime.strptime(from_date, "%Y-%m-%d") + timedelta(days=1)
            ).strftime("%Y-%m-%d")

        if to_date:
            to_date = (
                datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
            ).strftime("%Y-%m-%d")

        # ── REGISTRATIONS ─────────────────────────────────────
        reg_clauses = ["1=1"]
        reg_params = []

        if tts and tts != "teb":
            reg_clauses.append("tts = %s")
            reg_params.append(tts)

        if from_date:
            reg_clauses.append("created_at >= %s")
            reg_params.append(from_date + " 00:00:00")

        if to_date:
            reg_clauses.append("created_at <= %s")
            reg_params.append(to_date + " 23:59:59")

        cur.execute(
            f"SELECT COUNT(*) AS cnt FROM members WHERE {' AND '.join(reg_clauses)}",
            reg_params
        )
        registrations = int(cur.fetchone().get("cnt") or 0)

        # ── BETSLIPS ──────────────────────────────────────────
        bs_join = ""
        bs_clauses = ["1=1"]
        bs_params = []

        if tts and tts != "teb":
            bs_join = "JOIN members m ON b.username = m.username"
            bs_clauses.append("m.tts = %s")
            bs_params.append(tts)

        if from_date:
            bs_clauses.append("b.created_at >= %s")
            bs_params.append(from_date + " 00:00:00")

        if to_date:
            bs_clauses.append("b.created_at <= %s")
            bs_params.append(to_date + " 23:59:59")

        bs_where = "WHERE " + " AND ".join(bs_clauses)

        # ── DEBUG (optional) ──────────────────────────────────
        cur.execute("SELECT COUNT(*) AS cnt FROM betslips")
        print("ALL BETSLIPS:", cur.fetchone())

        if from_date and to_date:
            cur.execute("""
                SELECT COUNT(*) AS cnt
                FROM betslips
                WHERE created_at >= %s
                AND created_at <= %s
            """, [
                from_date + " 00:00:00",
                to_date + " 23:59:59"
            ])
            print("DATE FILTERED:", cur.fetchone())

        # ── AGGREGATED ───────────────────────────────────────
        cur.execute(f"""
            SELECT
                COUNT(*) AS betslip_count,
                COALESCE(SUM(b.bet_amount), 0) AS total_bet,
                COALESCE(SUM(
                    CASE
                        WHEN LOWER(TRIM(b.status)) IN ('won','win')
                        THEN b.bet_amount * b.total_odd
                        ELSE 0
                    END
                ), 0) AS coins_earned
            FROM betslips b
            {bs_join}
            {bs_where}
        """, bs_params)

        agg = cur.fetchone()

        # ── PER USER ──────────────────────────────────────────
        cur.execute(f"""
            SELECT
                b.username,
                COUNT(*) AS betslip_count,
                COALESCE(SUM(b.bet_amount), 0) AS total_bet,
                COALESCE(SUM(
                    CASE
                        WHEN LOWER(TRIM(b.status)) IN ('won','win')
                        THEN b.bet_amount * b.total_odd
                        ELSE 0
                    END
                ), 0) AS coins_earned
            FROM betslips b
            {bs_join}
            {bs_where}
            GROUP BY b.username
            ORDER BY betslip_count DESC
            LIMIT 200
        """, bs_params)

        user_rows = rows(cur)

        user_stats = []
        for u in user_rows:
            user_stats.append({
                "username": u.get("username", ""),
                "betslip_count": int(u.get("betslip_count") or 0),
                "total_bet": float(u.get("total_bet") or 0),
                "coins_earned": float(u.get("coins_earned") or 0),
            })

        return jsonify({
            "registrations": registrations,
            "betslip_count": int(agg.get("betslip_count") or 0),
            "total_bet": float(agg.get("total_bet") or 0),
            "coins_earned": float(agg.get("coins_earned") or 0),
            "user_stats": user_stats,
        })

    finally:
        cur.close()
        conn.close()

def get_random_slot_number():

    settings = load_settings()

    slot_odds = settings.get("slotOdds", {})

    ranges = [
        (
            slot_odds.get("0", {}).get("start", 0),
            slot_odds.get("0", {}).get("end", 0),
            slot_odds.get("0", {}).get("chance", 20),
        ),
        (
            slot_odds.get("1_8", {}).get("start", 1),
            slot_odds.get("1_8", {}).get("end", 8),
            slot_odds.get("1_8", {}).get("chance", 33),
        ),
        (
            slot_odds.get("9_15", {}).get("start", 9),
            slot_odds.get("9_15", {}).get("end", 15),
            slot_odds.get("9_15", {}).get("chance", 20),
        ),
        (
            slot_odds.get("16_25", {}).get("start", 16),
            slot_odds.get("16_25", {}).get("end", 25),
            slot_odds.get("16_25", {}).get("chance", 14),
        ),
        (
            slot_odds.get("26_30", {}).get("start", 26),
            slot_odds.get("26_30", {}).get("end", 30),
            slot_odds.get("26_30", {}).get("chance", 8),
        ),
        (
            slot_odds.get("31_45", {}).get("start", 31),
            slot_odds.get("31_45", {}).get("end", 45),
            slot_odds.get("31_45", {}).get("chance", 4),
        ),
        (
            slot_odds.get("46_75", {}).get("start", 46),
            slot_odds.get("46_75", {}).get("end", 75),
            slot_odds.get("46_75", {}).get("chance", 2),
        ),
    ]

    weighted_ranges = []

    for start, end, chance in ranges:
        weighted_ranges.append({
            "range": (start, end),
            "chance": chance
        })

    selected = random.choices(
        weighted_ranges,
        weights=[r["chance"] for r in weighted_ranges],
        k=1
    )[0]

    start, end = selected["range"]

    return random.randint(start, end)


def get_slot_reward_type(number):

    if 1 <= number <= 20:
        return "S"

    elif 21 <= number <= 40:
        return "B"

    else:
        return "J"


def slot_api(action):
    conn = db()
    cur = conn.cursor()

    try:

        # ---------------------------------
        # SPIN
        # ---------------------------------
        if action == "spin":

            data = request.get_json(force=True)

            username = safe_username(data.get("username"))

            if not username:
                return jsonify({
                    "success": False,
                    "error": "Missing username"
                }), 400

            # -------------------------
            # GET USER
            # -------------------------
            cur.execute(
                "SELECT spinsLeft FROM members WHERE username=%s",
                (username,)
            )

            user = cur.fetchone()

            if not user:
                return jsonify({
                    "success": False,
                    "error": "User not found"
                }), 404

            spins_left = int(
                user["spinsLeft"]
                if user["spinsLeft"] is not None
                else 0
            )

            # -------------------------
            # NO SPINS LEFT
            # -------------------------
            if spins_left <= 0:
                return jsonify({
                    "success": False,
                    "error": "No spins left"
                }), 400




            # -------------------------
            # SPIN LOGIC
            # -------------------------


            slot_number = get_random_slot_number()

            reward_type = get_slot_reward_type(slot_number)

            print(slot_number)
            print(reward_type)

            # -------------------------
            # REMOVE 1 SPIN
            # -------------------------
            cur.execute("""
                UPDATE members
                SET spinsLeft = spinsLeft - 1
                WHERE username=%s
            """, (username,))

            conn.commit()

            return jsonify({
                "success": True,
                "slot_number": slot_number,
                "reward_type": reward_type,
                "remaining_spins": spins_left - 1
            })
        
        
        return jsonify({
            "success": False,
            "error": "Invalid slot action"
        }), 400

    finally:
        cur.close()
        conn.close()












def champion_api(action):
    PHNOM_PENH = pytz.timezone("Asia/Phnom_Penh")
    today = datetime.now(PHNOM_PENH).strftime("%Y-%m-%d")

    conn = db()
    cur = conn.cursor()

    try:
        # ── GET: visible matches (user-facing) ────────────────────────────
        if action == "get":
            cur.execute("SELECT * FROM champion WHERE visibility = 1 ORDER BY created_at DESC")
            return jsonify(cur.fetchall())

        # ── GET: all matches (admin) ──────────────────────────────────────
        if action == "get_all":
            cur.execute("SELECT * FROM champion ORDER BY created_at DESC")
            return jsonify(cur.fetchall())

        # ── GET: picks for one user ───────────────────────────────────────
        if action == "get_picks":
            username = request.args.get("username", "").strip()
            cur.execute("""
                SELECT cp.*, c.team1, c.team2, c.match_label
                FROM champion_picks cp
                LEFT JOIN champion c ON c.id = cp.match_id
                WHERE cp.username = %s
                ORDER BY cp.created_at DESC
            """, (username,))
            return jsonify(cur.fetchall())

        # ── GET: picks remaining today ────────────────────────────────────
        if action == "picks_remaining":
            username = request.args.get("username", "").strip()
            try:
                settings = load_settings()
                daily_limit = int(settings.get("dailyChampionLimit", 5))
            except Exception:
                daily_limit = 5
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM champion_picks WHERE username = %s AND pick_date = %s",
                (username, today)
            )
            row = cur.fetchone()
            used = row["cnt"] if row else 0
            return jsonify({"remaining": max(0, daily_limit - used), "used": used, "limit": daily_limit})

        # ── GET: all picks paginated (admin) ──────────────────────────────
        if action == "get_all_picks":
            limit  = int(request.args.get("limit",  50))
            offset = int(request.args.get("offset",  0))
            search = request.args.get("search", "").strip()
            like   = f"%{search}%"
            cur.execute("""
                SELECT cp.*, c.team1, c.team2, c.match_label
                FROM champion_picks cp
                LEFT JOIN champion c ON c.id = cp.match_id
                WHERE cp.username LIKE %s
                ORDER BY cp.created_at DESC
                LIMIT %s OFFSET %s
            """, (like, limit, offset))
            picks = cur.fetchall()
            cur.execute("SELECT COUNT(*) AS total FROM champion_picks WHERE username LIKE %s", (like,))
            total = (cur.fetchone() or {}).get("total", 0)
            return jsonify({"picks": picks, "total": total})

        # ── POST actions ──────────────────────────────────────────────────
        body = request.get_json(silent=True) or {}

        # Submit picks
        if action == "pick":
            picks = body if isinstance(body, list) else [body]
            if not picks:
                return jsonify({"success": False, "error": "No picks provided"}), 400

            username = picks[0].get("username", "").strip()
            try:
                settings = load_settings()
                daily_limit = int(settings.get("dailyChampionLimit", 5))
            except Exception:
                daily_limit = 5

            cur.execute(
                "SELECT COUNT(*) AS cnt FROM champion_picks WHERE username = %s AND pick_date = %s",
                (username, today)
            )
            used = (cur.fetchone() or {}).get("cnt", 0)
            if used + len(picks) > daily_limit:
                remaining = max(0, daily_limit - used)
                return jsonify({"success": False, "error": f"Only {remaining} pick(s) remaining today", "remaining": remaining}), 400

            inserted = 0
            for pick in picks:
                u    = pick.get("username", "").strip()
                mid  = pick.get("match_id", "").strip()
                team = pick.get("selected_team", "").strip()
                pout = int(pick.get("payout", 10))
                if not u or not mid or team not in ("team1", "team2"):
                    continue
                try:
                    cur.execute("""
                        INSERT INTO champion_picks (username, match_id, selected_team, payout, status, pick_date)
                        VALUES (%s, %s, %s, %s, 'pending', %s)
                        ON DUPLICATE KEY UPDATE
                            selected_team = VALUES(selected_team),
                            payout        = VALUES(payout),
                            status        = 'pending',
                            pick_date     = VALUES(pick_date)
                    """, (u, mid, team, pout, today))
                    inserted += 1
                except Exception as e:
                    print(f"champion pick insert error: {e}")

            conn.commit()
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM champion_picks WHERE username = %s AND pick_date = %s",
                (username, today)
            )
            used_now = (cur.fetchone() or {}).get("cnt", used + inserted)
            return jsonify({"success": True, "inserted": inserted, "remaining": max(0, daily_limit - used_now)})

        # Save (create/update) match
        if action == "save":
            match_id = (body.get("id") or "").strip()
            team1    = (body.get("team1") or "").strip()
            team2    = (body.get("team2") or "").strip()
            logo1    = (body.get("team1_logo") or "").strip()
            logo2    = (body.get("team2_logo") or "").strip()
            label    = (body.get("match_label") or "").strip()
            payout   = int(body.get("payout", 10))
            vis      = 1 if body.get("visibility", True) else 0

            if not team1 or not team2:
                return jsonify({"success": False, "error": "team1 and team2 are required"}), 400

            if match_id:
                cur.execute("""
                    UPDATE champion
                    SET team1=%s, team2=%s, team1_logo=%s, team2_logo=%s,
                        match_label=%s, payout=%s, visibility=%s
                    WHERE id=%s
                """, (team1, team2, logo1, logo2, label, payout, vis, match_id))
                conn.commit()
                return jsonify({"success": True, "id": match_id})
            else:
                new_id = str(uuid.uuid4())[:16]
                cur.execute("""
                    INSERT INTO champion (id, team1, team2, team1_logo, team2_logo, match_label, payout, visibility)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (new_id, team1, team2, logo1, logo2, label, payout, vis))
                conn.commit()
                return jsonify({"success": True, "id": new_id})

        # Delete match
        if action == "delete":
            match_id = (body.get("id") or "").strip()
            if not match_id:
                return jsonify({"success": False, "error": "id required"}), 400
            cur.execute("DELETE FROM champion_picks WHERE match_id = %s", (match_id,))
            cur.execute("DELETE FROM champion WHERE id = %s", (match_id,))
            conn.commit()
            return jsonify({"success": True})

        # Set winner + process payouts
        if action == "set_winner":
            match_id = (body.get("id") or "").strip()
            winner   = (body.get("winner") or "").strip()
            if not match_id or winner not in ("team1", "team2"):
                return jsonify({"success": False, "error": "id and winner (team1|team2) required"}), 400

            cur.execute("SELECT * FROM champion WHERE id = %s", (match_id,))
            match = cur.fetchone()
            if not match:
                return jsonify({"success": False, "error": "Match not found"}), 404
            if match.get("awarded"):
                return jsonify({"success": True, "message": "Already awarded", "payoutsProcessed": 0})

            cur.execute("UPDATE champion SET winner=%s, awarded=1 WHERE id=%s", (winner, match_id))

            cur.execute("""
                SELECT username, payout FROM champion_picks
                WHERE match_id=%s AND selected_team=%s AND status='pending'
            """, (match_id, winner))
            winners = cur.fetchall()

            payouts_processed = 0
            for row in winners:
                try:
                    cur.execute(
                        "UPDATE members SET promotion_balance = promotion_balance + %s WHERE username = %s",
                        (row["payout"], row["username"])
                    )
                    payouts_processed += 1
                except Exception as e:
                    print(f"champion payout error for {row['username']}: {e}")

            cur.execute("""
                UPDATE champion_picks
                SET status = CASE WHEN selected_team=%s THEN 'won' ELSE 'lost' END
                WHERE match_id=%s
            """, (winner, match_id))
            conn.commit()
            return jsonify({"success": True, "winner": winner, "payoutsProcessed": payouts_processed})

        # Toggle visibility
        if action == "toggle_visibility":
            match_id = (body.get("id") or "").strip()
            vis      = 1 if body.get("visibility", True) else 0
            if not match_id:
                return jsonify({"success": False, "error": "id required"}), 400
            cur.execute("UPDATE champion SET visibility=%s WHERE id=%s", (vis, match_id))
            conn.commit()
            return jsonify({"success": True})

        # Upload team logo
        if action == "upload_logo":
            file     = request.files.get("logo")
            match_id = (request.form.get("matchId") or "").strip()
            team     = int(request.form.get("team", 0))

            if not file or not match_id or team not in [1, 2]:
                return jsonify({"success": False, "error": "Missing logo, matchId, or team"}), 400

            ext = file.filename.rsplit(".", 1)[-1].lower()
            if ext not in ["png", "jpg", "jpeg", "webp", "gif"]:
                return jsonify({"success": False, "error": "Invalid file type"}), 400

            safe_id  = re.sub(r"[^a-zA-Z0-9_-]", "", match_id)
            filename = secure_filename(f"champion_{safe_id}_team{team}_{int(time.time())}.{ext}")
            path     = os.path.join(UPLOAD_DIR, filename)
            file.save(path)

            logo_url = f"/public/images/logos/{filename}"
            column   = "team1_logo" if team == 1 else "team2_logo"
            cur.execute(f"UPDATE champion SET {column}=%s WHERE id=%s", (logo_url, match_id))
            conn.commit()
            return jsonify({"success": True, "logoUrl": logo_url})

        return jsonify({"error": f"Unknown champion action: {action}"}), 400

    except Exception as e:
        print(f"champion_api error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


def admin_api(action):
    conn = db()
    print("Setup database finished")
    cur = conn.cursor()

    try:
        if action == "login":
            data = request.get_json(force=True)

            cur.execute(
                "SELECT username, password, role FROM admins WHERE username=%s",
                (data.get("username"),)
            )

            admin = cur.fetchone()

            if admin and admin["password"] == data.get("password"):
                return jsonify({
                    "success": True,
                    "username": admin["username"],
                    "role": admin["role"]
                })

            return jsonify({"error": "Invalid credentials"}), 401

        if action == "get_all":
            cur.execute("SELECT username, role, created_at FROM admins")
            return jsonify(rows(cur))

        if action == "save":
            data = request.get_json(force=True)

            cur.execute("""
                INSERT INTO admins (username, password, role)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    password=VALUES(password),
                    role=VALUES(role)
            """, (
                data.get("username"),
                data.get("password"),
                data.get("role", "agent")
            ))

            conn.commit()
            return jsonify({"success": True})

        if action == "delete":
            username = request.args.get("username", "")

            if username == "teb":
                return jsonify({"error": "Cannot delete super admin"}), 400

            cur.execute("DELETE FROM admins WHERE username=%s", (username,))
            conn.commit()
            return jsonify({"success": True})

        if action == "reset_spins":
            with open("setting.json", "r", encoding="utf-8") as file:
                settings = json.load(file)

            daily_spin_limit = int(settings.get("dailySpinLimit", 5))

            cur.execute("""
                UPDATE members
                SET spinsLeft = %s
            """, (daily_spin_limit,))

            conn.commit()

            return jsonify({
                "success": True,
                "updated_users": cur.rowcount,
                "spinsLeft": daily_spin_limit
            })

        if action == "reset_football_guess":
            with open("setting.json", "r", encoding="utf-8") as file:
                settings = json.load(file)

            daily_football_limit = int(settings.get("dailyFootballLimit", 5))

            cur.execute("""
                UPDATE members
                SET football_guess = %s
            """, (daily_football_limit,))

            conn.commit()

            return jsonify({
                "success": True,
                "updated_users": cur.rowcount,
                "football_guess": daily_football_limit
            })


        return jsonify({"error": "Invalid admin action"}), 400

    finally:
        cur.close()
        conn.close()


# ─────────────────────────────────────────────────────────────
# DEPOSIT PROGRESS API
# GET  /api?type=deposit_progress&action=get&username=xxx
# POST /api?type=deposit_progress&action=add      body: {username, amount}
# POST /api?type=deposit_progress&action=set      body: {username, amount}
# POST /api?type=deposit_progress&action=claim    body: {username, milestone}
# POST /api?type=deposit_progress&action=reset    body: {username}
# ─────────────────────────────────────────────────────────────
def deposit_progress_api(action):
    conn = db()
    cur  = conn.cursor()

    try:
        # ── GET ──────────────────────────────────────────────
        if action == "get":
            username = safe_username(request.args.get("username", ""))
            if not username:
                return jsonify({"error": "Missing username"}), 400

            cur.execute(
                "SELECT username, Deposit_progress, claimedDepositBonuses FROM members WHERE username=%s",
                (username,)
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "User not found"}), 404

            return jsonify({
                "username":               row["username"],
                "Deposit_progress":       float(row["Deposit_progress"] or 0),
                "claimedDepositBonuses":  decode_json(row.get("claimedDepositBonuses"), default=[]),
            })

        # ── ADD  (scraper calls this after a new deposit) ────
        if action == "add":
            data     = request.get_json(force=True)
            username = safe_username(data.get("username", ""))
            amount   = float(data.get("amount", 0))

            if not username:
                return jsonify({"error": "Missing username"}), 400
            if amount <= 0:
                return jsonify({"error": "Amount must be > 0"}), 400

            # Only update if member exists
            cur.execute("SELECT username FROM members WHERE username=%s", (username,))
            if not cur.fetchone():
                return jsonify({"error": "User not found", "username": username}), 404

            cur.execute(
                "UPDATE members SET Deposit_progress = IFNULL(Deposit_progress,0) + %s WHERE username=%s",
                (amount, username)
            )
            conn.commit()

            # Return updated value
            cur.execute("SELECT Deposit_progress FROM members WHERE username=%s", (username,))
            updated = cur.fetchone()
            return jsonify({
                "success":          True,
                "username":         username,
                "added":            amount,
                "Deposit_progress": float(updated["Deposit_progress"] or 0),
            })

        # ── SET  (admin / test utility) ──────────────────────
        if action == "set":
            data     = request.get_json(force=True)
            username = safe_username(data.get("username", ""))
            amount   = float(data.get("amount", 0))

            if not username:
                return jsonify({"error": "Missing username"}), 400

            cur.execute(
                "UPDATE members SET Deposit_progress=%s WHERE username=%s",
                (amount, username)
            )
            conn.commit()
            return jsonify({"success": True, "username": username, "Deposit_progress": amount})

        # ── CLAIM  (user clicks a milestone arrow) ───────────
        if action == "claim":
            data      = request.get_json(force=True)
            username  = safe_username(data.get("username", ""))
            milestone = int(data.get("milestone", 0))

            if not username or not milestone:
                return jsonify({"error": "Missing username or milestone"}), 400

            VALID_MILESTONES = [10, 25, 100, 500, 1000]
            if milestone not in VALID_MILESTONES:
                return jsonify({"error": f"Invalid milestone. Must be one of {VALID_MILESTONES}"}), 400

            # Get current state
            cur.execute(
                "SELECT Deposit_progress, claimedDepositBonuses, promotion_balance FROM members WHERE username=%s",
                (username,)
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "User not found"}), 404

            progress = float(row["Deposit_progress"] or 0)
            claimed  = decode_json(row.get("claimedDepositBonuses"), default=[])

            if milestone in claimed:
                return jsonify({"error": "Milestone already claimed"}), 400
            if progress < milestone:
                return jsonify({"error": f"Progress {progress} has not reached milestone {milestone}"}), 400

            # Load bonus range from settings
            try:
                with open("setting.json", "r", encoding="utf-8") as f:
                    setting_data = json.load(f)
                ranges = setting_data.get("depositBonusRanges", {})
                rng    = ranges.get(str(milestone), {"min": 5, "max": 15})
            except Exception:
                rng = {"min": 5, "max": 15}

            reward = random.randint(int(rng["min"]), int(rng["max"]))

            # Update: add reward to promotion_balance, mark milestone claimed
            claimed.append(milestone)
            new_balance = float(row["promotion_balance"] or 0) + reward

            cur.execute(
                """UPDATE members
                   SET promotion_balance=%s, claimedDepositBonuses=%s
                   WHERE username=%s""",
                (new_balance, json_text(claimed), username)
            )
            conn.commit()

            return jsonify({
                "success":               True,
                "username":              username,
                "milestone":             milestone,
                "reward":                reward,
                "new_promotion_balance": new_balance,
                "claimedDepositBonuses": claimed,
            })

        # ── RESET  (test / monthly reset utility) ────────────
        if action == "reset":
            data     = request.get_json(force=True)
            username = safe_username(data.get("username", ""))

            if not username:
                return jsonify({"error": "Missing username"}), 400

            cur.execute(
                "UPDATE members SET Deposit_progress=0, claimedDepositBonuses='[]' WHERE username=%s",
                (username,)
            )
            conn.commit()
            return jsonify({"success": True, "username": username, "Deposit_progress": 0, "claimedDepositBonuses": []})

        return jsonify({"error": "Invalid deposit_progress action"}), 400

    finally:
        cur.close()
        conn.close()


print("BOTTOM REACHED")
print("__name__ =", __name__)

if __name__ == "__main__":

    print("Starting Flask server...")
    app.run(host="127.0.0.1", port=5001)
