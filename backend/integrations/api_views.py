import secrets

from django.conf import settings
from django.http import HttpResponse
from django.utils.html import escape
from rest_framework import permissions, status, views
from rest_framework.response import Response

from users.permissions import IsAdmin

from .google import build_auth_url, exchange_code_for_tokens, get_oauth_config
from .models import GoogleOAuthCredential, GoogleOAuthState


class GoogleOAuthStatusView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        cred = GoogleOAuthCredential.get_active()
        return Response(
            {
                "connected": bool(cred and cred.is_connected()),
                "calendar_id": getattr(cred, "calendar_id", "") or "",
            }
        )


class GoogleOAuthStartView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        client_id, client_secret, redirect_uri, scopes = get_oauth_config()
        if not client_id or not client_secret:
            return Response(
                {"detail": "Google OAuth client is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        state = secrets.token_urlsafe(24)
        GoogleOAuthState.objects.create(state=state)
        return Response(
            {
                "auth_url": build_auth_url(state),
                "redirect_uri": redirect_uri,
                "scopes": scopes,
            }
        )


class GoogleOAuthCallbackView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        state = (request.query_params.get("state") or "").strip()
        code = (request.query_params.get("code") or "").strip()
        error = (request.query_params.get("error") or "").strip()

        if error:
            return HttpResponse(f"Google OAuth failed: {escape(error)}", status=400)
        if not state or not code:
            return HttpResponse("Missing state or code.", status=400)

        st = GoogleOAuthState.objects.filter(state=state, used_at__isnull=True).first()
        if not st:
            return HttpResponse("Invalid/expired state.", status=400)

        try:
            exchange_code_for_tokens(code)
            st.mark_used()
        except Exception as e:
            return HttpResponse(f"Token exchange failed: {escape(str(e))}", status=400)

        frontend_url = getattr(settings, "GOOGLE_OAUTH_SUCCESS_REDIRECT", "") or ""
        if frontend_url:
            # Simple JS redirect to frontend.
            safe = escape(frontend_url)
            return HttpResponse(f"<script>window.location='{safe}';</script>Connected. Redirecting...", content_type="text/html")
        return HttpResponse("Google Calendar connected successfully. You can close this tab.")

