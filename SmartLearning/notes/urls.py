from django.urls import path

from . import views

urlpatterns = [
    path("", views.workspace, name="workspace"),
    path("p/<int:page_id>/", views.workspace, name="workspace_page"),

    # JSON API
    path("api/pages/", views.api_page_create, name="api_page_create"),
    path("api/pages/<int:page_id>/", views.api_page_detail, name="api_page_detail"),
    path("api/pages/<int:page_id>/move/", views.api_page_move, name="api_page_move"),
    path("api/pages/<int:page_id>/blocks/", views.api_block_create, name="api_block_create"),
    path("api/pages/<int:page_id>/reorder/", views.api_block_reorder, name="api_block_reorder"),
    path("api/blocks/<int:block_id>/", views.api_block_detail, name="api_block_detail"),

    # Exports
    path("p/<int:page_id>/export/md/", views.export_markdown, name="workspace_page_export_md"),
    path("backup/", views.export_backup, name="workspace_backup"),
]
