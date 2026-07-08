# 7fun7 deposit scraper - optimized with caching
import json
import time
import mysql.connector
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

LOGIN_URL = "https://7fun7.kg8.info/index.php"
REPORT_URL = "https://7fun7.kg8.info/affiliate/reports/deposit_report.php"
MEMBER_URL = "https://7fun7.kg8.info/affiliate/accounts/member_list.php?id=117549"

USERNAME = "teb3"
PASSWORD = "aaaa8888"

COOKIE_FILE = "cookies.json"

DB_CONFIG = {
    "host": "srv595.hstgr.io",
    "user": "u297159044_7fun7s",
    "password": "@Ubet988",
    "database": "u297159044_7fun7s"
}

# -------------------
# COOKIE FUNCTIONS
# -------------------
def save_cookies(driver):
    cookies = {c["name"]: c["value"] for c in driver.get_cookies() if c["name"] in ["AWSALB","AWSALBCORS","PHPSESSID"]}
    with open(COOKIE_FILE,"w") as f:
        json.dump(cookies,f)

def load_cookies(driver):
    try:
        with open(COOKIE_FILE) as f:
            cookies = json.load(f)
        for name,value in cookies.items():
            driver.add_cookie({"name":name,"value":value,"domain":"7fun7.kg8.info","path":"/"})
        return True
    except:
        return False

# -------------------
# LOGIN FUNCTIONS
# -------------------
def login(driver):
    driver.get(LOGIN_URL)
    time.sleep(3)
    driver.find_element(By.XPATH,"/html/body/div[1]/div/div[3]/form/div[1]/input").send_keys(USERNAME)
    driver.find_element(By.XPATH,"/html/body/div[1]/div/div[3]/form/div[2]/input").send_keys(PASSWORD)
    captcha = driver.find_element(By.XPATH,"/html/body/div[1]/div/div[3]/form/div[3]/div/span").text
    driver.find_element(By.XPATH,"/html/body/div[1]/div/div[3]/form/div[3]/div/input").send_keys(captcha)
    driver.find_element(By.XPATH,"//input[@class='btn_submit']").click()
    time.sleep(5)
    save_cookies(driver)
    print("Logged in successfully")

def ensure_login(driver):
    driver.get(REPORT_URL)
    time.sleep(2)
    if load_cookies(driver):
        driver.refresh()
        time.sleep(3)
        driver.get(REPORT_URL)
        time.sleep(3)
        if "index.php" not in driver.current_url:
            print("Using existing cookies, session valid")
            return
    print("Cookies expired or missing, performing login")
    login(driver)

# -------------------
# SCRAPE DEPOSITS
# -------------------
def get_deposit(driver):
    rows = driver.find_elements(By.XPATH,"/html/body/div[1]/div[2]/table/tbody/tr")
    deposits = []
    for row in rows[1:]:
        cols = row.find_elements(By.TAG_NAME,"td")
        if len(cols)<14:
            continue
        user_block = cols[2].text.split("\n")
        username = user_block[0] if len(user_block)>0 else ""
        tts = user_block[1] if len(user_block)>1 else ""
        is_new = user_block[2].replace("(","").replace(")","") if len(user_block)>2 else ""
        try: amount = float(cols[3].text.replace(",","").strip())
        except: amount = 0.0
        def parse_time(t):
            try: return datetime.strptime(t.strip(),"%Y-%m-%d %H:%M:%S")
            except: return None
        time1 = parse_time(cols[11].text)
        time2 = parse_time(cols[12].text)
        deposit = {
            "idx": cols[0].text,
            "status": cols[1].text,
            "username": username,       # TTS agent code (e.g. tts3) - NOT the player
            "tts": tts,
            "is_new": is_new,
            "amount": amount,
            "member_name": cols[4].text,  # Actual player username (col 4)
            "bank": cols[6].text,
            "account_name": cols[7].text,
            "account_number": cols[8].text,
            "ref": cols[9].text,
            "time1": time1,
            "time2": time2,
            "ip": cols[13].text
        }
        deposits.append(deposit)
    return deposits

# -------------------
# SCRAPE MEMBERS
# -------------------
def get_member(driver):
    rows = driver.find_elements(By.XPATH,"/html/body/div[1]/div/div[2]/table/tbody/tr")
    members = []
    for row in rows[1:]:
        cols = row.find_elements(By.TAG_NAME,"td")
        if len(cols)<10:
            continue
        try: username = cols[1].find_element(By.TAG_NAME,"a").text.strip()
        except: username = cols[1].text.strip()
        tts = cols[2].text.strip()
        try: total_deposit = float(cols[6].text.replace("USD","").strip())
        except: total_deposit = 0.0
        try: balance = float(cols[7].text.strip())
        except: balance = 0.0
        times = cols[8].text.strip().split("\n")
        time1 = times[0].strip() if len(times)>0 else ""
        time2 = times[1].strip() if len(times)>1 else ""
        status = cols[9].text.strip()
        members.append([username, tts, total_deposit, balance, time1, time2, status])
    return members

# -------------------
# DEPOSIT PROGRESS
# -------------------
def update_deposit_progress(member_name, amount):
    """
    Cross-check member_name (col 4 from deposit report = actual player username)
    against the members table. If found, increment Deposit_progress in users table.

    Flow:
      1. Check members table for member_name
      2. If exists → UPDATE users SET Deposit_progress += amount WHERE username = member_name
      3. Print result for monitoring
    """
    if not member_name or not str(member_name).strip():
        return
    member_name = str(member_name).strip()
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Step 1: Confirm this person is a registered member
        cursor.execute("SELECT username FROM members WHERE username = %s", (member_name,))
        if not cursor.fetchone():
            print(f"  ⚠  '{member_name}' not found in members table — skipping progress update")
            conn.close()
            return

        # Step 2: Add deposit amount to their Deposit_progress in members table
        cursor.execute(
            "UPDATE members SET Deposit_progress = IFNULL(Deposit_progress, 0) + %s WHERE username = %s",
            (amount, member_name)
        )
        affected = cursor.rowcount
        conn.commit()
        conn.close()

        if affected > 0:
            print(f"  ✔  Deposit_progress +{amount} → '{member_name}'")
        else:
            print(f"  ℹ  '{member_name}' is in members but has no row in users table — no update")
    except Exception as e:
        print(f"  ✗  update_deposit_progress error for '{member_name}': {e}")


# -------------------
# SAVE TO MYSQL
# -------------------
def save_to_mysql(rows):
    if not rows:
        return 0
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("SELECT username, account_number, ref, time1 FROM deposits")
    existing = { (r[0], r[1], r[2], r[3]) for r in cursor.fetchall() }
    sql = """INSERT INTO deposits
        (idx,status,username,tts,is_new,amount,member_name,bank,
        account_name,account_number,ref,time1,time2,ip)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"""
    new_count = 0
    new_deposits = []  # track new rows so we can update Deposit_progress after commit
    for r in rows:
        key = (r["username"], r["account_number"], r["ref"], r["time1"])
        if key in existing:
            continue
        try:
            cursor.execute(sql,(
                r["idx"],r["status"],r["username"],r["tts"],r["is_new"],r["amount"],
                r["member_name"],r["bank"],r["account_name"],r["account_number"],
                r["ref"],r["time1"],r["time2"],r["ip"]
            ))
            new_count += 1
            new_deposits.append(r)
        except Exception as e:
            print("Insert error:", e, r)
    conn.commit()
    conn.close()

    # After deposit is safely committed, update each member's Deposit_progress
    for r in new_deposits:
        print(f"  → New deposit: member='{r['member_name']}' amount=${r['amount']}")
        update_deposit_progress(r["member_name"], r["amount"])

    return new_count


def save_members_to_mysql(members):
    if not members:
        return (0,0)
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    cursor.execute("SELECT username, tts, total_deposit, balance, time1, time2, status FROM members")
    existing = { r[0]: r for r in cursor.fetchall() }  # username -> tuple
    new_count = 0
    updated_count = 0
    for m in members:
        username, tts, total_deposit, balance, time1, time2, status = m
        if username not in existing:
            cursor.execute("""INSERT INTO members (username, tts, total_deposit, balance, time1, time2, status)
                              VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                           (username, tts, total_deposit, balance, time1, time2, status))
            new_count += 1
        else:
            e = existing[username]
            if (e[1]!=tts or float(e[2])!=total_deposit or float(e[3])!=balance or e[4]!=time1 or e[5]!=time2 or e[6]!=status):
                cursor.execute("""UPDATE members SET tts=%s,total_deposit=%s,balance=%s,time1=%s,time2=%s,status=%s
                                  WHERE username=%s""",
                               (tts,total_deposit,balance,time1,time2,status,username))
                updated_count += 1
    conn.commit()
    conn.close()
    return new_count, updated_count

# -------------------
# MAIN LOOP
# -------------------
def main_loop():
    chrome_options = Options()
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    ensure_login(driver)

    while True:
        try:
            # ----- Get Members -----
            driver.get(MEMBER_URL)
            time.sleep(4)
            # members = get_member(driver)
            # new_members, updated_members = save_members_to_mysql(members)
            # print(f"Members checked: {len(members)}, New: {new_members}, Updated: {updated_members}")

            # ----- Get Deposits -----
            driver.get(REPORT_URL)
            time.sleep(4)
            deposits = get_deposit(driver)
            new_deposits = save_to_mysql(deposits)
            print(f"Deposits checked: {len(deposits)}, New: {new_deposits}")

        except Exception as e:
            print("Error:", e)

        time.sleep(20)

if __name__=="__main__":
    main_loop()
