import requests
import json
import time
import os

# Configuration
API_KEYS_FILE = 'api_keys.txt'
OUTPUT_FILE = 'public/data.json'
REGIONS = 'uk,eu,us,au'
MARKETS = 'h2h,spreads,totals,draw_no_bet,both_teams_to_score'
ODDS_FORMAT = 'decimal'
DATE_FORMAT = 'iso'

# List of soccer leagues sport_key from The Odds API
SPORTS = [
    "soccer_epl",                       # English Premier League
    "soccer_efl_champ",                 # EFL Championship
    "soccer_england_league1",           # England League One
    "soccer_england_league2",           # England League Two
    "soccer_spain_la_liga",             # Spain La Liga
    "soccer_spain_segunda_division",    # Spain Segunda Division
    "soccer_italy_serie_a",             # Italy Serie A
    "soccer_italy_serie_b",             # Italy Serie B
    "soccer_germany_bundesliga",        # Germany Bundesliga
    "soccer_germany_bundesliga2",       # Germany Bundesliga 2
    "soccer_france_ligue_one",          # France Ligue 1
    "soccer_france_ligue_two",          # France Ligue 2
    "soccer_netherlands_eredivisie",    # Netherlands Eredivisie
    "soccer_portugal_primeira_liga",    # Portugal Primeira Liga
    "soccer_turkey_super_league",       # Turkey Super Lig
    "soccer_russia_premier_league",     # Russia Premier League
    "soccer_scotland_premiership",      # Scottish Premiership
    "soccer_uefa_champs_league",        # UEFA Champions League
    "soccer_uefa_europa_league",        # UEFA Europa League
    "soccer_uefa_europa_conference_league", # UEFA Conference League
    "soccer_uefa_nations_league",       # UEFA Nations League
    "soccer_uefa_european_championship",# UEFA Euro
    "soccer_fifa_world_cup",            # FIFA World Cup
    "soccer_fifa_world_cup_winner",     # World Cup Winner
    "soccer_fifa_club_world_cup",       # Club World Cup
    "soccer_usa_mls",                   # Major League Soccer
    "soccer_mexico_ligamx",             # Mexico Liga MX
    "soccer_brazil_campeonato",         # Brazil Serie A
    "soccer_argentina_primera_division",# Argentina Primera Division
    "soccer_chile_campeonato",          # Chile Primera Division
    "soccer_colombia_primera_a",        # Colombia Primera A
    "soccer_conmebol_copa_libertadores",# Copa Libertadores
    "soccer_conmebol_copa_sudamericana",# Copa Sudamericana
    "soccer_conmebol_copa_america",     # Copa America
    "soccer_japan_j_league",            # Japan J League
    "soccer_korea_kleague1",            # South Korea K League 1
    "soccer_australia_aleague",         # Australia A League
    "soccer_china_superleague",         # China Super League
    "soccer_india_super_league",        # India Super League
    "soccer_saudi_pro_league",          # Saudi Pro League
]

def load_api_keys():
    if not os.path.exists(API_KEYS_FILE):
        print(f"Error: {API_KEYS_FILE} not found.")
        return []
    with open(API_KEYS_FILE, 'r') as f:
        keys = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    return keys

def fetch_odds(api_key, sport):
    url = f'https://api.the-odds-api.com/v4/sports/{sport}/odds'
    params = {
        'apiKey': api_key,
        'regions': REGIONS,
        'markets': MARKETS,
        'oddsFormat': ODDS_FORMAT,
        'dateFormat': DATE_FORMAT,
    }
    try:
        response = requests.get(url, params=params)
        if response.status_code == 429:
            return None, "rate_limit"
        elif response.status_code != 200:
            return None, "error"
        return response.json(), "success"
    except Exception as e:
        print(f"Request failed for {sport}: {e}")
        return None, "exception"

def main():
    keys = load_api_keys()
    if not keys:
        print("No API keys found. Please add them to api_keys.txt")
        return

    all_data = []
    current_key_index = 0
    
    for sport in SPORTS:
        success = False
        while current_key_index < len(keys):
            key = keys[current_key_index]
            print(f"Fetching {sport} using key {current_key_index + 1}...")
            
            data, status = fetch_odds(key, sport)
            
            if status == "success":
                print(f"  Successfully fetched {len(data)} matches for {sport}")
                all_data.extend(data)
                success = True
                break
            elif status == "rate_limit":
                print(f"  Rate limit reached for key {current_key_index + 1}. Switching...")
                current_key_index += 1
            else:
                print(f"  Error fetching {sport} with key {current_key_index + 1}. Trying next key...")
                current_key_index += 1
        
        if not success:
            print(f"  Failed to fetch {sport} with all available keys.")

    if all_data:
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(all_data, f, indent=4)
        print(f"\nTotal matches saved: {len(all_data)} to {OUTPUT_FILE}")
        
        # Trigger migration
        MIGRATE_URL = 'https://db.7fun7-api.online/api?type=migrate'
        try:
            print(f"Triggering migration at {MIGRATE_URL}...")
            resp = requests.get(MIGRATE_URL, timeout=120)
            print(f"Migration response: {resp.text}")
        except Exception as e:
            print(f"Migration trigger failed: {e}")
    else:
        print("No data fetched.")

if __name__ == "__main__":
    main()
