from django.contrib.auth.decorators import login_required
from django.db.models import Count, F, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from academics.forms import SubjectForm
from academics.models import Note, Subject


def _subject_queryset(user):
    return (
        Subject.objects.filter(owner=user)
        .annotate(
            estudo_count=Count("notes", filter=Q(notes__category=Note.Category.ESTUDO)),
            trabalho_count=Count("notes", filter=Q(notes__category=Note.Category.TRABALHO)),
            prova_count=Count("notes", filter=Q(notes__category=Note.Category.PROVA)),
        )
        .order_by("name")
    )


def _notes_for_subject(subject, sort):
    notes = subject.notes.select_related("workspace_page")
    if sort == "upcoming":
        task_order = ["is_done", F("due_date").asc(nulls_last=True), "-created_at"]
        return {
            Note.Category.ESTUDO: notes.filter(category=Note.Category.ESTUDO).order_by("-created_at"),
            Note.Category.PROVA: notes.filter(category=Note.Category.PROVA).order_by(*task_order),
            Note.Category.TRABALHO: notes.filter(category=Note.Category.TRABALHO).order_by(*task_order),
        }
    return {
        category: notes.filter(category=category).order_by("-created_at")
        for category in Note.Category.values
    }


@login_required
def course_list(request):
    return render(request, "courses/course_list.html", {
        "subjects": _subject_queryset(request.user),
        "subject_form": SubjectForm(),
    })


@login_required
def subject_detail(request, pk):
    subject = get_object_or_404(Subject, pk=pk, owner=request.user)
    sort = request.GET.get("sort") or "upcoming"
    if sort not in {"upcoming", "recent"}:
        sort = "upcoming"

    grouped = _notes_for_subject(subject, sort)
    return render(request, "courses/subject_detail.html", {
        "subject": subject,
        "sort": sort,
        "groups": [
            ("estudo", "Estudo", grouped[Note.Category.ESTUDO]),
            ("prova", "Prova", grouped[Note.Category.PROVA]),
            ("trabalho", "Trabalho", grouped[Note.Category.TRABALHO]),
        ],
    })


@login_required
def course_create(request):
    return redirect("course_list")


@login_required
def subject_edit(request, pk):
    subject = get_object_or_404(Subject, pk=pk, owner=request.user)
    if request.method == "POST":
        form = SubjectForm(request.POST, instance=subject)
        if form.is_valid():
            form.save()
            return redirect("subject_detail", pk=subject.pk)
    else:
        form = SubjectForm(instance=subject)
    return render(request, "courses/subject_form.html", {
        "form": form,
        "subject": subject,
    })


@login_required
@require_POST
def course_delete(request, pk):
    subject = get_object_or_404(Subject, pk=pk, owner=request.user)
    subject.delete()
    return redirect("course_list")
