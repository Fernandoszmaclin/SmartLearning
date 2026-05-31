from django import template

register = template.Library()


@register.filter
def get(mapping, key):
    """Look up a dict value by a variable key inside a template."""
    try:
        return mapping.get(key)
    except AttributeError:
        return None
