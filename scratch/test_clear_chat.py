import urllib.request
import json

def fetch_history():
    try:
        url = "http://127.0.0.1:8000/api/chat/history"
        res = urllib.request.urlopen(url, timeout=3).read()
        return json.loads(res.decode('utf-8'))
    except Exception as e:
        print("Error fetching history:", e)
        return []

def send_message(msg):
    try:
        url = "http://127.0.0.1:8000/api/chat"
        req = urllib.request.Request(
            url,
            data=json.dumps({"message": msg}).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        res = urllib.request.urlopen(req, timeout=3).read()
        return json.loads(res.decode('utf-8'))
    except Exception as e:
        print("Error sending message:", e)
        return None

def clear_history():
    try:
        url = "http://127.0.0.1:8000/api/chat"
        req = urllib.request.Request(url, method="DELETE")
        res = urllib.request.urlopen(req, timeout=3).read()
        return json.loads(res.decode('utf-8'))
    except Exception as e:
        print("Error clearing history:", e)
        return None

if __name__ == "__main__":
    print("1. Fetching current history...")
    hist = fetch_history()
    print(f"Current history length: {len(hist)}")

    print("\n2. Sending test message to create history...")
    resp = send_message("Olá, teste de limpeza")
    if resp:
        print("Bot reply:", resp.get("response"))

    hist_after = fetch_history()
    print(f"History length after message: {len(hist_after)}")

    print("\n3. Clearing chat history...")
    clear_resp = clear_history()
    print("Clear response:", clear_resp)

    hist_final = fetch_history()
    print(f"Final history length (should be 0): {len(hist_final)}")
