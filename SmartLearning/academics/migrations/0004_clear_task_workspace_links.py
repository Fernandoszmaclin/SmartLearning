from django.db import migrations


def clear_task_links(apps, schema_editor):
    """Trabalho/prova não vinculam mais páginas do Workspace (só a matéria).

    Desvincula (SET NULL) qualquer página ainda apontada por essas anotações.
    As páginas em si continuam existindo no Workspace.
    """
    Note = apps.get_model("academics", "Note")
    Note.objects.filter(
        category__in=["trabalho", "prova"], workspace_page__isnull=False
    ).update(workspace_page=None)


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0003_note_difficulty_note_estimated_time"),
    ]

    operations = [
        migrations.RunPython(clear_task_links, migrations.RunPython.noop),
    ]
