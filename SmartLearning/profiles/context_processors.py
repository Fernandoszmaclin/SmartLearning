from .models import Profile


def active_profile(request):
    if not request.user.is_authenticated:
        return {"active_profile": None}
    profile, _ = Profile.objects.get_or_create(user=request.user)
    return {"active_profile": profile}
