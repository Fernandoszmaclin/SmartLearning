from django.contrib import admin

from .models import Block, Page


class BlockInline(admin.TabularInline):
    model = Block
    extra = 0
    fields = ("position", "kind", "text", "checked")
    ordering = ("position",)


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ("display_title", "owner", "parent", "is_favorite", "updated_at")
    list_filter = ("is_favorite", "owner")
    search_fields = ("title",)
    inlines = [BlockInline]


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("page", "kind", "position", "checked")
    list_filter = ("kind", "checked")
