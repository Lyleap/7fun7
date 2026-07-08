"""
test_deposit_progress.py
------------------------
Test Deposit_progress via the Flask API (db.7fun7-api.online).
No direct MySQL connection needed — works from any PC.

Usage:
  python test_deposit_progress.py
"""

import requests

API_BASE = "https://db.7fun7-api.online/api"


def get_progress(username):
    r = requests.get(API_BASE, params={
        "type": "deposit_progress",
        "action": "get",
        "username": username
    })
    return r.json()


def add_progress(username, amount):
    r = requests.post(API_BASE, params={
        "type": "deposit_progress",
        "action": "add"
    }, json={"username": username, "amount": amount})
    return r.json()


def set_progress(username, amount):
    r = requests.post(API_BASE, params={
        "type": "deposit_progress",
        "action": "set"
    }, json={"username": username, "amount": amount})
    return r.json()


def reset_progress(username):
    r = requests.post(API_BASE, params={
        "type": "deposit_progress",
        "action": "reset"
    }, json={"username": username})
    return r.json()


def list_all_users():
    """Fetch all users and show their Deposit_progress."""
    r = requests.get(API_BASE, params={
        "type": "user",
        "action": "get",
        "limit": 200,
        "offset": 0
    })
    data = r.json()
    users = data.get("users", [])
    if not users:
        print("  (no users found)")
        return
    print(f"\n  {'USERNAME':<20} {'PROGRESS':>10}  {'CLAIMED'}")
    print(f"  {'-'*20} {'-'*10}  {'-'*30}")
    for u in users:
        prog    = u.get("Deposit_progress", 0) or 0
        claimed = u.get("claimedDepositBonuses", []) or []
        print(f"  {str(u['username']):<20} {str(prog):>10}  {claimed}")
    print()


def print_result(data):
    if "error" in data:
        print(f"  ✗  Error: {data['error']}")
    else:
        print(f"  ✔  {data}")


if __name__ == "__main__":
    print("\n========================================")
    print("  Deposit Progress — API Test Utility")
    print(f"  API: {API_BASE}")
    print("========================================\n")

    print("[ All users ]")
    list_all_users()

    TEST_USER = input("Enter username to test: ").strip()
    if not TEST_USER:
        print("No username entered. Exiting.")
        exit()

    # Show current state
    print("\n[ Current state ]")
    print_result(get_progress(TEST_USER))

    print("\nWhat do you want to do?")
    print("  1  Add amount to Deposit_progress")
    print("  2  Reset progress to 0")
    print("  3  Set progress to a specific value")
    print("  4  Just show current progress")
    choice = input("\nChoice (1/2/3/4): ").strip()

    if choice == "1":
        amt = input("Amount to add (e.g. 10, 25, 100): ").strip()
        try:
            print_result(add_progress(TEST_USER, float(amt)))
        except ValueError:
            print("  ✗  Invalid amount.")

    elif choice == "2":
        confirm = input(f"Reset '{TEST_USER}' progress to 0? (y/n): ").strip().lower()
        if confirm == "y":
            print_result(reset_progress(TEST_USER))

    elif choice == "3":
        val = input("Set Deposit_progress to: ").strip()
        try:
            print_result(set_progress(TEST_USER, float(val)))
        except ValueError:
            print("  ✗  Invalid value.")

    elif choice == "4":
        pass  # already shown above

    else:
        print("  ✗  Invalid choice.")

    # Show final state
    print("\n[ Final state ]")
    print_result(get_progress(TEST_USER))
    print()
