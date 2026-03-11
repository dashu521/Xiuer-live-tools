import requests
import json

# Test 1: ultra + active trial => effective_plan = ultra
print("=== Test 1: ultra + active trial ===")
resp = requests.post("http://localhost:8000/login", json={"username": "13193990716", "password": "meiyoumima1"})
print("Login status:", resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    token = data.get("token")
    print("Token obtained")

    headers = {"Authorization": f"Bearer {token}"}
    status_resp = requests.get("http://localhost:8000/status", headers=headers)
    print("\n/status response:")
    result = status_resp.json()
    print(json.dumps(result, indent=2, ensure_ascii=False))

    print("\n--- Verification ---")
    plan_value = result.get("plan")
    print("plan:", plan_value)
    print("Expected: ultra (because users.plan=ultra, should not be overridden by trial)")
    if plan_value == "ultra":
        print("PASS: ultra user correctly shows ultra, not trial")
    else:
        print("FAIL: expected ultra, got", plan_value)
else:
    print("Login failed:", resp.text)
