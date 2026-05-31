from django import forms

from .models import Course


class CourseForm(forms.ModelForm):
    class Meta:
        model = Course
        fields = ["title", "summary", "description", "level", "is_published"]
        widgets = {
            "title": forms.TextInput(attrs={"class": "input", "placeholder": "Nome da matéria"}),
            "summary": forms.TextInput(attrs={"class": "input", "placeholder": "Resumo curto (aparece no card)"}),
            "description": forms.Textarea(attrs={"class": "input", "rows": 6, "placeholder": "Descrição completa"}),
            "level": forms.Select(attrs={"class": "input"}),
        }
