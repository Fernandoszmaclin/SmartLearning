import os
import re
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.http import url_has_allowed_host_and_scheme


PROFILE_PHOTO_MAX_SIZE = 5 * 1024 * 1024
WORKSPACE_FILE_MAX_SIZE = 10 * 1024 * 1024

PROFILE_PHOTO_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
PROFILE_PHOTO_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

WORKSPACE_FILE_EXTENSIONS = {
    "csv",
    "doc",
    "docx",
    "gif",
    "jpeg",
    "jpg",
    "md",
    "pdf",
    "png",
    "ppt",
    "pptx",
    "txt",
    "webp",
    "xls",
    "xlsx",
    "zip",
}
WORKSPACE_FILE_CONTENT_TYPES = {
    "application/msword",
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/csv",
    "text/markdown",
    "text/plain",
}

HEX_COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _bool_env(name, default=False):
    value = str(os.environ.get(name, default)).strip().lower()
    return value in {"1", "true", "yes", "on"}


def safe_redirect_url(request, value, fallback=None):
    if not value:
        return fallback
    if url_has_allowed_host_and_scheme(
        value,
        allowed_hosts={request.get_host(), *settings.ALLOWED_HOSTS},
        require_https=request.is_secure(),
    ):
        return value
    return fallback


def validate_hex_color(value):
    if not HEX_COLOR_RE.match(value or ""):
        raise ValidationError("Informe uma cor hexadecimal no formato #RRGGBB.")


def validate_uploaded_file(uploaded_file, *, allowed_extensions, allowed_content_types, max_size):
    if not uploaded_file:
        return

    if uploaded_file.size and uploaded_file.size > max_size:
        max_mb = max_size // (1024 * 1024)
        raise ValidationError(f"O arquivo deve ter no maximo {max_mb} MB.")

    extension = Path(uploaded_file.name or "").suffix.lower().lstrip(".")
    if extension not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        raise ValidationError(f"Tipo de arquivo nao permitido. Use: {allowed}.")

    content_type = getattr(uploaded_file, "content_type", "")
    if content_type and content_type not in allowed_content_types:
        raise ValidationError("O tipo MIME do arquivo nao confere com os tipos permitidos.")


def validate_profile_photo(uploaded_file):
    validate_uploaded_file(
        uploaded_file,
        allowed_extensions=PROFILE_PHOTO_EXTENSIONS,
        allowed_content_types=PROFILE_PHOTO_CONTENT_TYPES,
        max_size=PROFILE_PHOTO_MAX_SIZE,
    )


def validate_workspace_file(uploaded_file):
    validate_uploaded_file(
        uploaded_file,
        allowed_extensions=WORKSPACE_FILE_EXTENSIONS,
        allowed_content_types=WORKSPACE_FILE_CONTENT_TYPES,
        max_size=WORKSPACE_FILE_MAX_SIZE,
    )
