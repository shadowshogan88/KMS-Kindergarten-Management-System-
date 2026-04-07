from django.urls import path

from .api_views import GoogleOAuthCallbackView, GoogleOAuthStartView, GoogleOAuthStatusView


urlpatterns = [
    path("google/oauth/status/", GoogleOAuthStatusView.as_view()),
    path("google/oauth/start/", GoogleOAuthStartView.as_view()),
    path("google/oauth/callback/", GoogleOAuthCallbackView.as_view()),
]

