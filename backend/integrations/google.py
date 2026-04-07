import os
import json
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.utils import timezone

from .models import GoogleOAuthCredential


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"


def _env(name: str, default: str = "") -> str:
    # Read from environment first (loaded via python-dotenv in settings/base.py),
    # then fall back to Django settings attribute if present.
    return str(os.environ.get(name) or getattr(settings, name, default) or default)


def get_oauth_config():
    client_id = _env("GOOGLE_OAUTH_CLIENT_ID", "")
    client_secret = _env("GOOGLE_OAUTH_CLIENT_SECRET", "")
    redirect_uri = _env(
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://127.0.0.1:8000/api/v1/google/oauth/callback/",
    )
    scopes = _env(
        "GOOGLE_OAUTH_SCOPES",
        "https://www.googleapis.com/auth/calendar.events",
    )
    return client_id, client_secret, redirect_uri, scopes.split()


def build_auth_url(state: str) -> str:
    client_id, _, redirect_uri, scopes = get_oauth_config()
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


def _post_form(url: str, data: dict[str, Any]) -> dict[str, Any]:
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=30) as res:
        raw = res.read().decode("utf-8")
    return json.loads(raw)


def exchange_code_for_tokens(code: str) -> GoogleOAuthCredential:
    client_id, client_secret, redirect_uri, _ = get_oauth_config()
    data = _post_form(
        GOOGLE_TOKEN_URL,
        {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    )
    cred = GoogleOAuthCredential.get_active() or GoogleOAuthCredential()
    cred.access_token = data.get("access_token", "") or ""
    cred.refresh_token = data.get("refresh_token", "") or cred.refresh_token
    cred.scope = data.get("scope", "") or cred.scope
    cred.token_type = data.get("token_type", "Bearer") or "Bearer"
    expires_in = int(data.get("expires_in") or 0)
    cred.expires_at = timezone.now() + timezone.timedelta(seconds=expires_in) if expires_in else None
    if not cred.calendar_id:
        cred.calendar_id = _env("GOOGLE_CALENDAR_ID", "primary") or "primary"
    cred.save()
    return cred


def refresh_access_token(cred: GoogleOAuthCredential) -> GoogleOAuthCredential:
    client_id, client_secret, _, _ = get_oauth_config()
    data = _post_form(
        GOOGLE_TOKEN_URL,
        {
            "refresh_token": cred.refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
        },
    )
    cred.access_token = data.get("access_token", "") or ""
    cred.token_type = data.get("token_type", "Bearer") or "Bearer"
    expires_in = int(data.get("expires_in") or 0)
    cred.expires_at = timezone.now() + timezone.timedelta(seconds=expires_in) if expires_in else None
    cred.save(update_fields=["access_token", "token_type", "expires_at", "updated_at"])
    return cred


def get_valid_credential() -> GoogleOAuthCredential:
    cred = GoogleOAuthCredential.get_active()
    if not cred or not cred.is_connected():
        raise RuntimeError("Google Calendar is not connected.")
    if not cred.is_access_token_valid():
        cred = refresh_access_token(cred)
    return cred


@dataclass
class CreatedMeet:
    event_id: str
    meet_link: str


def create_calendar_event_with_meet(payload: dict[str, Any]) -> CreatedMeet:
    cred = get_valid_credential()
    calendar_id = urllib.parse.quote(cred.calendar_id or "primary", safe="")
    url = f"{GOOGLE_CALENDAR_BASE}/calendars/{calendar_id}/events?conferenceDataVersion=1"

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"{cred.token_type} {cred.access_token}")
    with urllib.request.urlopen(req, timeout=30) as res:
        raw = res.read().decode("utf-8")
    data = json.loads(raw)

    event_id = data.get("id", "") or ""
    meet_link = data.get("hangoutLink", "") or ""
    if not meet_link:
        conf = data.get("conferenceData") or {}
        entry_points = conf.get("entryPoints") or []
        for ep in entry_points:
            if ep.get("entryPointType") == "video" and ep.get("uri"):
                meet_link = ep["uri"]
                break

    return CreatedMeet(event_id=event_id, meet_link=meet_link)


def patch_calendar_event(event_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    cred = get_valid_credential()
    calendar_id = urllib.parse.quote(cred.calendar_id or "primary", safe="")
    safe_event_id = urllib.parse.quote(event_id, safe="")
    url = f"{GOOGLE_CALENDAR_BASE}/calendars/{calendar_id}/events/{safe_event_id}?conferenceDataVersion=1"

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"{cred.token_type} {cred.access_token}")
    with urllib.request.urlopen(req, timeout=30) as res:
        raw = res.read().decode("utf-8")
    return json.loads(raw)


def delete_calendar_event(event_id: str) -> None:
    cred = get_valid_credential()
    calendar_id = urllib.parse.quote(cred.calendar_id or "primary", safe="")
    safe_event_id = urllib.parse.quote(event_id, safe="")
    url = f"{GOOGLE_CALENDAR_BASE}/calendars/{calendar_id}/events/{safe_event_id}"

    req = urllib.request.Request(url, method="DELETE")
    req.add_header("Authorization", f"{cred.token_type} {cred.access_token}")
    with urllib.request.urlopen(req, timeout=30) as res:
        res.read()
