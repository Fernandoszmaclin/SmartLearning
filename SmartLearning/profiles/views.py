from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from .forms import ProfileForm, UserProfileForm
from .models import Profile


@login_required
def profile_edit(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == "POST":
        user_form = UserProfileForm(request.POST, instance=request.user)
        profile_form = ProfileForm(request.POST, request.FILES, instance=profile)
        if user_form.is_valid() and profile_form.is_valid():
            user_form.save()
            profile_form.save()
            next_url = request.POST.get("next")
            if next_url:
                return redirect(next_url)
            return redirect("profile_edit")
    else:
        user_form = UserProfileForm(instance=request.user)
        profile_form = ProfileForm(instance=profile)

    return render(request, "profiles/profile_form.html", {
        "user_form": user_form,
        "profile_form": profile_form,
        "profile": profile,
    })


@login_required
@require_POST
def profile_toggle_theme(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    profile.theme = (
        Profile.Theme.LIGHT
        if profile.theme == Profile.Theme.DARK
        else Profile.Theme.DARK
    )
    profile.save(update_fields=["theme", "updated_at"])
    return redirect(request.POST.get("next") or "workspace")
