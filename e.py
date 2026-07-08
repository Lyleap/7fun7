import requests
import json
import time 
import os

API_KEYS_FILE = "api_keys.txt"
INVALID_KEYS_FILE = "invalid_api_key.txt"
API_URL ="https://db.7fun7-api.online/api"



last_score_update = 0
last_process = 0

SCORE_REFRESH = 120 * 60   # 2 Hour 
PROCESS_EVERY = 60 * 60   # 1 Hour



# Temp variable

score_cache = []




SPORTS = [
    "soccer_epl",
    "soccer_efl_champ",
    "soccer_england_league1",
    "soccer_england_league2",

    "soccer_spain_la_liga",
    "soccer_spain_segunda_division",

    "soccer_italy_serie_a",
    "soccer_italy_serie_b",

    "soccer_germany_bundesliga",
    "soccer_germany_bundesliga2",

    "soccer_france_ligue_one",
    "soccer_france_ligue_two",

    "soccer_netherlands_eredivisie",

    "soccer_portugal_primeira_liga",

    "soccer_turkey_super_league",

    "soccer_russia_premier_league",

    "soccer_belgium_first_div",

    "soccer_switzerland_superleague",

    "soccer_austria_bundesliga",

    "soccer_denmark_superliga",

    "soccer_sweden_allsvenskan",

    "soccer_norway_eliteserien",

    "soccer_finland_veikkausliiga",

    "soccer_poland_ekstraklasa",

    "soccer_greece_super_league",






    "soccer_usa_mls",

    "soccer_mexico_ligamx",

    "soccer_brazil_campeonato",

    "soccer_argentina_primera_division",

    "soccer_chile_campeonato",





    "soccer_china_superleague",

    "soccer_japan_j_league",

    "soccer_korea_kleague1",

    "soccer_australia_aleague",

    "soccer_saudi_arabia_pro_league",


    "soccer_uefa_champs_league",
    "soccer_uefa_europa_league",
    "soccer_uefa_europa_conference_league",
    "soccer_uefa_nations_league",
    "soccer_uefa_european_championship",

    "soccer_fifa_world_cup",

    "soccer_conmebol_copa_libertadores",
    "soccer_conmebol_copa_sudamericana",

    "soccer_africa_cup_of_nations",

    "soccer_england_efl_cup",

    "soccer_spain_copa_del_rey",

    "soccer_italy_coppa_italia",

    "soccer_germany_dfb_pokal",

    "soccer_france_coupe_de_france",


]


def load_api_keys():
    if not os.path.exists(API_KEYS_FILE):
        return []

    with open(API_KEYS_FILE, "r", encoding="utf-8") as f:
        keys = [k.strip() for k in f.readlines() if k.strip()]
    return keys


def remove_first_key():
    keys = load_api_keys()
    if not keys:
        return None

    used_key = keys.pop(0)

    with open(API_KEYS_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(keys))

    return used_key


def move_to_invalid(key):
    with open(INVALID_KEYS_FILE, "a", encoding="utf-8") as f:
        f.write(key + "\n")


def get_all_matches():
    request_url = API_URL + "?type=matches&action=get_all"
    

    try:
        response = requests.get(request_url, timeout=10)

        # Raise error for bad status codes
        response.raise_for_status()

        # Return parsed JSON
        data = response.json()
        return data

    except requests.exceptions.RequestException as e:
        print("Request failed:", e)
        return None

    except ValueError:
        print("Invalid JSON response")
        return None

all_match = get_all_matches()


def get_betslip(betslips_id):
    """
    Get betslip data from API.

    Args:
        betslips_id (str): Betslip receipt ID

    Returns:
        dict | list | None:
            Returned JSON data if successful,
            None if request failed
    """

    request_url = (
        f"{API_URL}?type=betslips&action=get&id={betslips_id}"
    )

    try:
        response = requests.get(request_url, timeout=10)

        # Raise error for bad status codes
        response.raise_for_status()

        # Return parsed JSON
        data = response.json()
        return data

    except requests.exceptions.RequestException as e:
        print("Request failed:", e)
        return None

    except ValueError:
        print("Invalid JSON response")



        return None
def build_match_map():
    match_map = {}

    for db_match in all_match:
        key = f"{db_match['home_team']} vs {db_match['away_team']}".lower().strip()
        match_map[key] = db_match["id"]

    return match_map


def find_match(betslip):
    match_map = build_match_map()

    found_ids = []
    sport_array = []

    for bet in betslip["matches"]:
        key = bet["matchName"].lower().strip()

        match_id = match_map.get(key)

        if match_id:
            found_ids.append(match_id)
        else:
            found_ids.append(None)

        sport_array.append(None)

    return found_ids, sport_array


def get_score_from_match(match):
    home_team = match.get("home_team")
    away_team = match.get("away_team")
    scores = match.get("scores") or []

    home_score = None
    away_score = None

    for item in scores:
        if item.get("name") == home_team:
            home_score = item.get("score")
        elif item.get("name") == away_team:
            away_score = item.get("score")

    return home_team, away_team, home_score, away_score



def get_score(STATE):

    # -------------------------
    # CACHE MODE
    # -------------------------
    if STATE is True:
        try:
            with open("Cache_score.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print("Failed to read cache:", e)
            return []

    # -------------------------
    # INIT
    # -------------------------
    cache_score_result_json = []

    sports_index = 0
    api_key = remove_first_key()

    if not api_key:
        print("No API keys available!")
        return []

    # -------------------------
    # MAIN LOOP (WITH RESUME)
    # -------------------------
    while sports_index < len(SPORTS):

        sport = SPORTS[sports_index]
        url = f"https://api.the-odds-api.com/v4/sports/{sport}/scores"

        params = {
            "apiKey": api_key,
            "daysFrom": 2,
            "dateFormat": "iso",
        }

        print(f"Checking: {sport} | using key: {api_key[:6]}...")

        try:
            response = requests.get(url, params=params, timeout=20)

            # -------------------------
            # INVALID KEY HANDLING
            # -------------------------
            if response.status_code in [401, 403]:
                print("API KEY INVALID:", api_key)

                move_to_invalid(api_key)

                api_key = remove_first_key()

                if not api_key:
                    print("No more API keys left!")
                    break

                continue  # retry SAME sport with new key

            if response.status_code != 200:
                if response.status_code == 404:
                    sports_index += 1  # only move forward on success

                print("Error:", response.status_code, response.text)
                continue

            matches = response.json()
            cache_score_result_json.extend(matches)

            sports_index += 1  # only move forward on success

        except Exception as e:
            print("Request failed:", e)

    # -------------------------
    # SAVE CACHE
    # -------------------------
    with open("Cache_score.json", "w", encoding="utf-8") as f:
        json.dump(cache_score_result_json, f, indent=4)

    print("Saved", len(cache_score_result_json), "matches to Cache_score.json")

    return cache_score_result_json



def check_score(match_id, score_list):
    for match in score_list:
        if match.get("id") != match_id:
            continue

        # match exists but NOT finished
        if not match.get("completed"):
            return "PENDING"

        home_team, away_team, home_score, away_score = get_score_from_match(match)

        # safety fallback
        if home_score is None or away_score is None:
            return "PENDING"

        return {
            "home": home_team,
            "home_score": float(home_score),
            "away": away_team,
            "away_score": float(away_score)
        }

    return None


def check(score,bet):

    # bet = json.loads(bet)
    # print(f"BET : {bet}")
    selector = bet["selection"]
    if "over" in selector.lower():
        total = float(score['away_score']) + int(score['home_score'])
        value = float(selector.replace("Over ",""))
        if total > value:
            # Win half / Win all checker
            difference = abs(total - value)
            if difference <= 0.26:
                return "WH"
            elif difference >= 0.27:
                return "WA"
        if total < value:
            # LOSE half / LOSE all checker
            difference = abs(total - value)
            
            if difference <= 0.26:
                return "LH"
            elif difference >= 0.27:
                return "LA"

            print(f"Prediction:{value},Score:{total}")
    
    elif "under" in selector.lower():

        value = float(selector.replace("Under ", ""))
        total = float(score['away_score']) + int(score['home_score'])

        # WIN
        if total < value:

            difference = abs(total - value)

            if difference <= 0.26:
                return "WH"   # Win Half

            elif difference >= 0.27:
                return "WA"   # Win All

        # LOSE
        elif total > value:

            difference = abs(total - value)

            if difference <= 0.26:
                return "LH"   # Lose Half

            elif difference >= 0.27:
                return "LA"   # Lose All
    elif "draw" in selector.lower():
        
        home = score['home']
        away = score['away']
        home_score = score['home_score']
        away_score = score['away_score']

        if home_score == away_score :
            return "WA"
        else:
            return "LA"
    elif "hdp" in selector.lower():
        
        home = score['home']
        away = score['away']
        home_score = float(score['home_score'])
        away_score = float(score['away_score'])

        selection_team = selector.split("HDP")[0].strip()
        selection_value = selector.split("HDP")[1].strip()
        
        # print("selected HDP :",selection_value)
        if "-" not in selection_value or "--" in selection_value:
            if home.lower() == selection_team.lower():
                if "--" in selection_value:
                    home_score += float(selection_value.replace("--",""))
                else:
                    home_score += float(selection_value)
            else:
                if "--" in selection_value:
                    away_score += float(selection_value.replace("--",""))
                else:
                    away_score += float(selection_value)

        else:
            if home.lower() == selection_team.lower():
                home_score -= float(selection_value.replace("-",""))
            else:
                away_score -= float(selection_value.replace("-",""))

        
        # print(f"{selection_team} |- Original Score: {score['home_score']}|{score['away_score']} - {home_score}-{away_score}")



        if home.lower() == selection_team.lower():
            
            difference = abs(home_score - away_score)
            if home_score > away_score:
                if difference <= 0.26:
                    return "WH"   # Win half

                elif difference >= 0.27:
                    return "WA"   # Win All
            elif home_score == away_score:
                return "DW"
            else:
                if difference <= 0.26:
                    return "LH"   # Win half

                elif difference >= 0.27:
                    return "LA"   # Win All
        
        else:
            
            difference = abs(home_score - away_score)
            if home_score < away_score:
                if difference <= 0.26:
                    return "WH"   # Win half

                elif difference >= 0.27:
                    return "WA"   # Win All
            elif home_score == away_score:
                return "DW"
            else:
                if difference >= 0.26:
                    return "LH"   # Win half

                elif difference >= 0.27:
                    return "LA"   # Win All




            
    
    
    
    else:
        home = score['home']
        away = score['away']
        home_score = score['home_score']
        away_score = score['away_score']
        # print(f"Team selector : {selector} | {home}-{away}")
        if selector.strip().lower() in home.strip().lower() or selector.strip().lower() == home.strip().lower():    
            if home_score > away_score:
                return "WA"
            else:
                return "LA"
        elif selector.strip().lower() in away.strip().lower() or selector.strip().lower() == away.strip().lower():    
            if home_score < away_score:
                return "WA"
            else:
                return "LA"
        
def update_betslip(receipt_id, status, matches):
    url = (
        API_URL+
        "?type=betslips&action=update_status"
    )

    payload = {
        "receipt_id": receipt_id,
        "status": status,
        "matches": matches
    }

    try:
        time.sleep(0.5)
        response = requests.post(url, json=payload, timeout=10)

        return response.json()

    except Exception as e:
        print("Update failed:", e)
        return None

def get_accepted_receipt_ids():
    url = API_URL+"?type=betslips&action=get_all&limit=200&&only_accepted=true"

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        data = response.json()
        betslips = data.get("betslips", [])

        accepted_ids = []

        for slip in betslips:
            if slip.get("status") == "ACCEPTED":
                accepted_ids.append(slip.get("receipt_id"))

        return accepted_ids

    except Exception as e:
        print("Failed to fetch accepted betslips:", e)
        return []
import json

def load_settings():
    with open("setting.json", "r", encoding="utf-8") as f:
        return json.load(f)
    

def process_betslip(betslip_id):
    BETSLIPS = get_betslip(betslip_id)

    id_list, sport_array = find_match(BETSLIPS)

    print("TOTAL BETSLIP MATCHES:", len(BETSLIPS["matches"]))
    print("FOUND API MATCHES:", len(id_list))

    cache_score_result_json = score_cache

    score = []
    for MATCH_ID in id_list:
        score.append(check_score(MATCH_ID, cache_score_result_json))

    updated_betslip = BETSLIPS

    settings = load_settings()

    current_stake = float(settings.get("defaultBetAmount", 10))
    any_LA = False
    formula_log = []

    matches_data = json.loads(BETSLIPS['matches_json'])

    correct = 0
    total = 0
    pending = 0

    for x in range(len(matches_data)):

        score_item = score[x] if x < len(score) else None

        # ⚠️ PENDING HANDLING
        if score_item == "PENDING" or score_item is None:
            pending += 1
            updated_betslip['matches'][x]['status'] = "PENDING"
            formula_log.append(f"Match {x+1}: PENDING")
            continue

        total += 1

        bet_match_status = check(score_item, matches_data[x])

        if bet_match_status in ["WA", "WH"]:
            correct += 1

        odd = updated_betslip['matches'][x]['odd']

        step = f"Match {x+1}: start={current_stake}"

        if bet_match_status == "WA":
            current_stake *= odd
            step += " → WA"

        elif bet_match_status == "WH":
            current_stake = (current_stake / 2) * odd + (current_stake / 2)
            step += " → WH"

        elif bet_match_status == "LH":
            current_stake /= 2
            step += " → LH"

        elif bet_match_status == "LA":
            current_stake = 0
            any_LA = True
            step += " → LA"

        updated_betslip['matches'][x]['status'] = bet_match_status
        formula_log.append(step)

    # ❗ IMPORTANT FIX: only finalize when no pending exists
    final_status = "ACCEPTED"

    if pending == 0:
        final_status = "LOSE" if any_LA else "WIN"

        update_betslip(
            receipt_id=betslip_id,
            status=final_status,
            matches=updated_betslip["matches"]
        )

    return {
        "status": final_status,
        "payout": current_stake,
        "log": formula_log,
        "correct": correct,
        "total": total,
        "pending": pending,
        "ratio": f"{correct}/{total}" if total > 0 else "0/0",
        "username": BETSLIPS.get("username")   # ✅ ADD THIS
    }



def add_user_balance(username, new_balance):
    # 1. GET user
    res = requests.get(
        API_URL,
        params={
            "type": "user",
            "action": "get",
            "username": username
        },
        timeout=10
    )

    data = res.json()

    if "error" in data:
        return {"success": False, "error": data["error"]}

    # 2. update only balance
    data["balance"] += float(new_balance)

    # 3. SAVE back
    save_res = requests.post(
        API_URL,
        params={
            "type": "user",
            "action": "save",
            "username": username
        },
        json=data,
        timeout=10
    )

    return save_res.json()



# result = process_betslip("RA1P2DFU0W")

# print(f"({"RA1P2DFU0W"}) | Status: {result['status']} | Payout: {result['payout']} | Ratio: {result['ratio']}")

score_cache = get_score(False)


while True:
    now = time.time()

    # 🔄 refresh score every 30 minutes
    if now - last_score_update >= SCORE_REFRESH:
        print("Refreshing score cache...")
        score_cache = get_score(True)
        last_score_update = now

    # 🧠 process bets every 15 minutes
    if now - last_process >= PROCESS_EVERY:
        print("Processing accepted betslips...")

        receipt_id_accepted = get_accepted_receipt_ids()

        for receipt_id in receipt_id_accepted:
            result = process_betslip(receipt_id)
            print(
                f"({receipt_id}) | User: {result['username']} | "
                f"Status: {result['status']} | "
                f"Payout: {result['payout']} | Ratio: {result['ratio']}"
            )
            if result['status'] == "WIN":
                # add_user_balance(result['username'],result['payout'])
                print("ADDED",result['username'],result['payout'])
        last_process = now

    time.sleep(10)