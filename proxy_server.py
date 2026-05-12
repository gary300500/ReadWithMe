import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


HOST = "127.0.0.1"
PORT = 11435


def json_response(handler, status, payload):
  body = json.dumps(payload).encode("utf-8")
  handler.send_response(status)
  handler.send_header("Content-Type", "application/json; charset=utf-8")
  handler.send_header("Content-Length", str(len(body)))
  handler.send_header("Access-Control-Allow-Origin", "*")
  handler.send_header("Access-Control-Allow-Headers", "Content-Type")
  handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
  handler.end_headers()
  handler.wfile.write(body)


def sanitize_base_url(raw):
  if not isinstance(raw, str) or not raw.strip():
    raise ValueError("Missing baseUrl")
  parsed = urlparse(raw.strip())
  if parsed.scheme not in ("http", "https") or not parsed.netloc:
    raise ValueError("Invalid baseUrl")
  return raw.rstrip("/")


def build_headers(api_key):
  headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  }
  if api_key:
    headers["Authorization"] = f"Bearer {api_key}"
  return headers


def forward_json(method, url, payload, headers):
  data = None if payload is None else json.dumps(payload).encode("utf-8")
  request = Request(url=url, method=method, data=data, headers=headers)
  try:
    with urlopen(request, timeout=45) as response:
      content_type = response.headers.get("Content-Type", "")
      raw_body = response.read()
      if "application/json" not in content_type:
        raise ValueError(f"Upstream returned non-JSON response: {content_type or 'unknown'}")
      return response.status, json.loads(raw_body.decode("utf-8"))
  except HTTPError as exc:
    raw_body = exc.read().decode("utf-8", errors="replace")
    try:
      payload = json.loads(raw_body)
    except json.JSONDecodeError:
      payload = {"error": {"message": raw_body or exc.reason}}
    return exc.code, payload
  except URLError as exc:
    raise ConnectionError(str(exc.reason)) from exc


def build_connection_test_body(model):
  if not isinstance(model, str) or not model.strip():
    raise ValueError("Missing model")
  return {
    "model": model.strip(),
    "messages": [
      {
        "role": "user",
        "content": "/no_think\nReply with exactly OK to confirm this model is usable.",
      }
    ],
    "temperature": 0,
    "max_tokens": 64,
  }


def extract_chat_content(payload):
  try:
    message = payload["choices"][0]["message"]
    return message.get("content") or message.get("reasoning") or ""
  except (KeyError, IndexError, TypeError):
    return ""


def extract_model_ids(payload):
  if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
    return []
  model_ids = []
  for item in payload["data"]:
    if isinstance(item, dict) and isinstance(item.get("id"), str):
      model_ids.append(item["id"])
  return model_ids


class ProxyHandler(BaseHTTPRequestHandler):
  def do_OPTIONS(self):
    self.send_response(204)
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Headers", "Content-Type")
    self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    self.end_headers()

  def do_POST(self):
    try:
      length = int(self.headers.get("Content-Length", "0"))
      data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
    except json.JSONDecodeError:
      json_response(self, 400, {"error": "Invalid JSON body"})
      return

    try:
      base_url = sanitize_base_url(data.get("baseUrl"))
      api_key = data.get("apiKey")
      headers = build_headers(api_key)
      if self.path == "/proxy/test":
        model = data.get("model")
        test_body = build_connection_test_body(model)
        models_checked = False
        models_status, models_payload = forward_json("GET", f"{base_url}/v1/models", None, headers)
        if models_status in (401, 403):
          json_response(self, models_status, {
            "ok": False,
            "status": models_status,
            "model": test_body["model"],
            "error": "API Key 无效或没有模型列表权限。",
            "upstream": models_payload,
          })
          return
        model_ids = extract_model_ids(models_payload) if models_status < 400 else []
        if model_ids:
          models_checked = True
          if test_body["model"] not in model_ids:
            json_response(self, 400, {
              "ok": False,
              "status": 400,
              "model": test_body["model"],
              "error": f"模型名称不可用：{test_body['model']}",
              "availableModels": model_ids[:20],
            })
            return
        status, payload = forward_json("POST", f"{base_url}/v1/chat/completions", test_body, headers)
        reply_preview = extract_chat_content(payload)
        ok = status < 400 and bool(str(reply_preview).strip())
        response_payload = {
          "ok": ok,
          "status": status,
          "testKind": "chat-completion",
          "model": test_body["model"],
          "modelVerified": ok,
          "modelsChecked": models_checked,
          "replyPreview": str(reply_preview).strip()[:80],
        }
        if not ok:
          response_payload["upstream"] = payload
        json_response(self, 200 if ok else status if status >= 400 else 502, response_payload)
        return
      if self.path == "/proxy/models":
        status, payload = forward_json("GET", f"{base_url}/v1/models", None, headers)
        json_response(self, 200 if status < 400 else status, payload)
        return
      if self.path == "/proxy/chat":
        body = data.get("body")
        if not isinstance(body, dict):
          raise ValueError("Missing chat body")
        status, payload = forward_json("POST", f"{base_url}/v1/chat/completions", body, headers)
        json_response(self, 200 if status < 400 else status, payload)
        return
      json_response(self, 404, {"error": "Unknown endpoint"})
    except ValueError as exc:
      json_response(self, 400, {"error": str(exc)})
    except ConnectionError as exc:
      json_response(self, 502, {"error": str(exc)})
    except Exception as exc:
      json_response(self, 500, {"error": str(exc)})

  def log_message(self, fmt, *args):
    return


if __name__ == "__main__":
  server = ThreadingHTTPServer((HOST, PORT), ProxyHandler)
  print(f"Proxy listening on http://{HOST}:{PORT}")
  server.serve_forever()
