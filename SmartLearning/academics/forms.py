from django import forms

from .models import Note, Subject


class SubjectForm(forms.ModelForm):
    class Meta:
        model = Subject
        fields = ["name", "professor", "color"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "input", "placeholder": "Ex.: Cálculo I"}),
            "professor": forms.TextInput(attrs={"class": "input", "placeholder": "Professor(a) (opcional)"}),
            "color": forms.TextInput(attrs={"type": "color", "class": "input-color"}),
        }


class NoteForm(forms.ModelForm):


    class Meta:
        model = Note
        fields = [
            "category", "title", "subject", "professor",
            "due_date", "is_done", "content", "difficulty", "estimated_time"
        ]
        widgets = {
            "category": forms.Select(attrs={"class": "input", "id": "id_category"}),
            "title": forms.TextInput(attrs={"class": "input", "placeholder": "Título da anotação"}),
            "subject": forms.Select(attrs={"class": "input"}),
            "professor": forms.TextInput(attrs={"class": "input", "placeholder": "Nome do professor(a)"}),
            "due_date": forms.DateInput(attrs={"class": "input", "type": "date"}, format="%Y-%m-%d"),
            "content": forms.Textarea(attrs={"class": "input", "rows": 8, "placeholder": "Escreva sua anotação..."}),
            "difficulty": forms.NumberInput(attrs={"class": "input", "min": 1, "max": 5}),
            "estimated_time": forms.NumberInput(attrs={"class": "input", "min": 5, "step": 5, "placeholder": "Minutos"}),
        }

    def __init__(self, *args, owner=None, **kwargs):
        super().__init__(*args, **kwargs)
        if owner is not None:
            self.fields["subject"].queryset = Subject.objects.filter(owner=owner)
        self.fields["subject"].empty_label = "— Sem matéria —"
        self.fields["due_date"].input_formats = ["%Y-%m-%d"]
