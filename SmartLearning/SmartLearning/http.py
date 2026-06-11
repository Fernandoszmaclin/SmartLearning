import json


def parse_json_body(request):
    """Lê o corpo JSON da request; devolve {} quando vazio ou inválido."""
    try:
        return json.loads(request.body or "{}")
    except (ValueError, TypeError):
        return {}
