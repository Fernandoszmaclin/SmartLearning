from django.contrib.auth import login
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import redirect, render


def signup(request):
    """Create an account, log the user in, and send them to the workspace."""
    if request.user.is_authenticated:
        return redirect("workspace")

    if request.method == "POST":
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("workspace")
    else:
        form = UserCreationForm()

    return render(request, "registration/signup.html", {"form": form})
