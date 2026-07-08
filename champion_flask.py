# ─────────────────────────────────────────────────────────────────────────────
# champion_flask.py  –  World Cup / Champion prediction routes
#
# INTEGRATION  (paste into databse-flask.py):
#
#  1. After the imports, add:
#       from champion_flask import champion_api, setup_champion_tables
#
#  2. Inside the api() route function, after the "slot" block, add:
#       if api_type == "champion":
#           return champion_api(action)
#
#  3. Inside setup_tables(), after the existing cur.execute blocks, call:
#       setup_champion_tables(cur)
#       conn.commit()
#
# ─────────────────────────────────────────────────────────────────────────────

from flask import request, jsonify
from datetime import datetime
import pytz
import uuid
import json


# ── Shared helpers ─────────────────────────────────────────────────────────
# These are already defined in databse-flask.py; import them when integrating.
# For standalone testing, stub them here.
try:
    from databse_flask import db, rows
except ImportError:
    db = None   # type: ignore
    rows = None  # type: ignore


PHNOM_PENH = pytz.timezone("Asia/Phnom_Penh")


def _today_pp():
    """Return today's date string in Asia/Phnom_Penh."""
    return datetime.now(PHNOM_PENH).strftime("%Y-%m-%d")


# ── Table DDL ──────────────────────────────────────────────────────────────

def setup_champion_tables(cur):
    """Call this inside setup_tables() after the existing DDL blocks."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS champion (
            id           VARCHAR(64)  PRIMARY KEY,
            team1        VARCHAR(255) NOT NULL,
            team2        VARCHAR(255) NOT NULL,
            team1_logo   VARCHAR(500) DEFAULT '',
            team2_logo   VARCHAR(500) DEFAULT '',
            match_label  VARCHAR(255) DEFAULT '',
            payout       INT          DEFAULT 10,
            winner       VARCHAR(10)  DEFAULT NULL,
            visibility   TINYINT(1)   DEFAULT 1,
            awarded      TINYINT(1)   DEFAULT 0,
            created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS champion_picks (
            id            BIGINT       AUTO_INCREMENT PRIMARY KEY,
            username      VARCHAR(255) NOT NULL,
            match_id      VARCHAR(64)  NOT NULL,
            selected_team VARCHAR(10)  NOT NULL,
            status        VARCHAR(20)  DEFAULT 'pending',
            payout        INT          DEFAULT 10,
            pick_date     DATE         NOT NULL,
            created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_match (username, match_id)
        )
    """)


# ── champion_api ───────────────────────────────────────────────────────────

def champion_api(action: str):
    """
    Dispatcher for ?type=champion&action=...

    Actions
    -------
    GET
      get              – visible matches (user-facing)
      get_all          – all matches including hidden (admin)
      get_picks        – picks for one user (?username=)
      picks_remaining  – how many picks user has left today (?username=)
      get_all_picks    – paginated picks (admin) (?limit=&offset=&search=)

    POST
      pick             – submit one or more picks (body: [{username, match_id, selected_team, payout}])
      save             – create / update a match (body: match fields)
      delete           – delete a match (body: {id})
      set_winner       – set winner and run payouts (body: {id, winner})
      toggle_visibility – flip visibility flag (body: {id, visibility})
    """
    conn = db()
    try:
        if action == "get":
            return _get_matches(conn, admin=False)

        if action == "get_all":
            return _get_matches(conn, admin=True)

        if action == "get_picks":
            username = request.args.get("username", "").strip()
            return _get_picks(conn, username)

        if action == "picks_remaining":
            username = request.args.get("username", "").strip()
            return _picks_remaining(conn, username)

        if action == "get_all_picks":
            limit  = int(request.args.get("limit",  50))
            offset = int(request.args.get("offset",  0))
            search = request.args.get("search", "").strip()
            return _get_all_picks(conn, limit, offset, search)

        # ── POST actions ──────────────────────────────────────────────────
        body = {}
        if request.is_json:
            body = request.get_json(silent=True) or {}
        elif request.data:
            try:
                body = json.loads(request.data)
            except Exception:
                pass

        if action == "pick":
            return _submit_picks(conn, body)

        if action == "save":
            return _save_match(conn, body)

        if action == "delete":
            return _delete_match(conn, body.get("id", ""))

        if action == "set_winner":
            return _set_winner(conn, body)

        if action == "toggle_visibility":
            return _toggle_visibility(conn, body)

        return jsonify({"error": f"Unknown champion action: {action}"}), 400

    finally:
        conn.close()


# ── Private helpers ────────────────────────────────────────────────────────

def _get_matches(conn, admin=False):
    cur = conn.cursor()
    if admin:
        cur.execute("SELECT * FROM champion ORDER BY created_at DESC")
    else:
        cur.execute(
            "SELECT * FROM champion WHERE visibility = 1 ORDER BY created_at DESC"
        )
    data = cur.fetchall()
    return jsonify(data)


def _get_picks(conn, username: str):
    if not username:
        return jsonify([])
    cur = conn.cursor()
    cur.execute("""
        SELECT
            cp.*,
            c.team1,
            c.team2,
            c.match_label
        FROM champion_picks cp
        LEFT JOIN champion c ON c.id = cp.match_id
        WHERE cp.username = %s
        ORDER BY cp.created_at DESC
    """, (username,))
    data = cur.fetchall()
    return jsonify(data)


def _picks_remaining(conn, username: str):
    """Return how many picks the user has left today based on settings.json."""
    try:
        with open("setting.json", "r", encoding="utf-8") as f:
            settings = json.load(f)
        daily_limit = int(settings.get("dailyChampionLimit", 5))
    except Exception:
        daily_limit = 5

    today = _today_pp()
    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM champion_picks WHERE username = %s AND pick_date = %s",
        (username, today),
    )
    row = cur.fetchone()
    used = row["cnt"] if row else 0
    remaining = max(0, daily_limit - used)
    return jsonify({"remaining": remaining, "used": used, "limit": daily_limit})


def _get_all_picks(conn, limit: int, offset: int, search: str):
    cur = conn.cursor()
    like = f"%{search}%"
    cur.execute(
        """
        SELECT
            cp.*,
            c.team1,
            c.team2,
            c.match_label
        FROM champion_picks cp
        LEFT JOIN champion c ON c.id = cp.match_id
        WHERE cp.username LIKE %s
        ORDER BY cp.created_at DESC
        LIMIT %s OFFSET %s
        """,
        (like, limit, offset),
    )
    picks = cur.fetchall()

    cur.execute(
        """
        SELECT COUNT(*) AS total
        FROM champion_picks cp
        WHERE cp.username LIKE %s
        """,
        (like,),
    )
    total_row = cur.fetchone()
    total = total_row["total"] if total_row else 0

    return jsonify({"picks": picks, "total": total})


def _submit_picks(conn, body):
    """
    body: list of {username, match_id, selected_team, payout}
    or a single dict.
    """
    picks = body if isinstance(body, list) else [body]
    if not picks:
        return jsonify({"success": False, "error": "No picks provided"}), 400

    today = _today_pp()
    username = picks[0].get("username", "").strip()

    # ── Daily limit check ──────────────────────────────────────────────────
    try:
        with open("setting.json", "r", encoding="utf-8") as f:
            settings = json.load(f)
        daily_limit = int(settings.get("dailyChampionLimit", 5))
    except Exception:
        daily_limit = 5

    cur = conn.cursor()
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM champion_picks WHERE username = %s AND pick_date = %s",
        (username, today),
    )
    row = cur.fetchone()
    used = row["cnt"] if row else 0

    if used + len(picks) > daily_limit:
        remaining = max(0, daily_limit - used)
        return jsonify({
            "success": False,
            "error": f"Only {remaining} pick(s) remaining today",
            "remaining": remaining,
        }), 400

    # ── Insert picks ───────────────────────────────────────────────────────
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

    # Return updated remaining count
    cur.execute(
        "SELECT COUNT(*) AS cnt FROM champion_picks WHERE username = %s AND pick_date = %s",
        (username, today),
    )
    used_now = (cur.fetchone() or {}).get("cnt", used + inserted)
    remaining_now = max(0, daily_limit - used_now)

    return jsonify({"success": True, "inserted": inserted, "remaining": remaining_now})


def _save_match(conn, body: dict):
    """Create or update a champion match."""
    match_id  = (body.get("id") or "").strip()
    team1     = (body.get("team1") or "").strip()
    team2     = (body.get("team2") or "").strip()
    logo1     = (body.get("team1_logo") or "").strip()
    logo2     = (body.get("team2_logo") or "").strip()
    label     = (body.get("match_label") or "").strip()
    payout    = int(body.get("payout", 10))
    vis       = 1 if body.get("visibility", True) else 0

    if not team1 or not team2:
        return jsonify({"success": False, "error": "team1 and team2 are required"}), 400

    cur = conn.cursor()

    if match_id:
        # Update existing
        cur.execute("""
            UPDATE champion
               SET team1 = %s, team2 = %s, team1_logo = %s, team2_logo = %s,
                   match_label = %s, payout = %s, visibility = %s
             WHERE id = %s
        """, (team1, team2, logo1, logo2, label, payout, vis, match_id))
        conn.commit()
        return jsonify({"success": True, "id": match_id})
    else:
        # Create new
        new_id = str(uuid.uuid4())[:16]
        cur.execute("""
            INSERT INTO champion (id, team1, team2, team1_logo, team2_logo, match_label, payout, visibility)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (new_id, team1, team2, logo1, logo2, label, payout, vis))
        conn.commit()
        return jsonify({"success": True, "id": new_id})


def _delete_match(conn, match_id: str):
    if not match_id:
        return jsonify({"success": False, "error": "id required"}), 400
    cur = conn.cursor()
    cur.execute("DELETE FROM champion_picks WHERE match_id = %s", (match_id,))
    cur.execute("DELETE FROM champion WHERE id = %s", (match_id,))
    conn.commit()
    return jsonify({"success": True})


def _set_winner(conn, body: dict):
    """
    Set winner and process payouts.
    Winning users get their payout added to promotion_balance in members.
    """
    match_id = (body.get("id") or "").strip()
    winner   = (body.get("winner") or "").strip()

    if not match_id or winner not in ("team1", "team2"):
        return jsonify({"success": False, "error": "id and winner (team1|team2) required"}), 400

    cur = conn.cursor()

    # Idempotency – skip if already awarded
    cur.execute("SELECT * FROM champion WHERE id = %s", (match_id,))
    match = cur.fetchone()
    if not match:
        return jsonify({"success": False, "error": "Match not found"}), 404

    if match.get("awarded"):
        return jsonify({
            "success": True,
            "message": "Already awarded",
            "payoutsProcessed": 0,
        })

    # Set winner on the match row
    cur.execute(
        "UPDATE champion SET winner = %s, awarded = 1 WHERE id = %s",
        (winner, match_id),
    )

    # Find winning picks
    cur.execute("""
        SELECT username, payout FROM champion_picks
        WHERE match_id = %s AND selected_team = %s AND status = 'pending'
    """, (match_id, winner))
    winners = cur.fetchall()

    payouts_processed = 0
    for row in winners:
        uname  = row["username"]
        amount = row["payout"]
        try:
            cur.execute("""
                UPDATE members
                   SET promotion_balance = promotion_balance + %s
                 WHERE username = %s
            """, (amount, uname))
            payouts_processed += 1
        except Exception as e:
            print(f"payout error for {uname}: {e}")

    # Mark all picks for this match as won/lost
    cur.execute("""
        UPDATE champion_picks
           SET status = CASE WHEN selected_team = %s THEN 'won' ELSE 'lost' END
         WHERE match_id = %s
    """, (winner, match_id))

    conn.commit()

    return jsonify({
        "success": True,
        "winner": winner,
        "payoutsProcessed": payouts_processed,
    })


def _toggle_visibility(conn, body: dict):
    match_id = (body.get("id") or "").strip()
    vis      = 1 if body.get("visibility", True) else 0

    if not match_id:
        return jsonify({"success": False, "error": "id required"}), 400

    cur = conn.cursor()
    cur.execute("UPDATE champion SET visibility = %s WHERE id = %s", (vis, match_id))
    conn.commit()
    return jsonify({"success": True})
