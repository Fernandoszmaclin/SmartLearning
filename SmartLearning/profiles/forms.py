from django import forms
from django.contrib.auth import get_user_model

from .models import Profile

User = get_user_model()


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email"]
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "input", "placeholder": "Nome"}),
            "last_name": forms.TextInput(attrs={"class": "input", "placeholder": "Sobrenome"}),
            "email": forms.EmailInput(attrs={"class": "input", "placeholder": "email@exemplo.com"}),
        }


class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ["photo", "bio", "theme"]
        widgets = {
            "photo": forms.FileInput(attrs={"class": "input", "accept": "image/*"}),
            "bio": forms.TextInput(attrs={"class": "input", "placeholder": "Uma frase sobre você"}),
            "theme": forms.Select(attrs={"class": "input"}),
        }
