"""Verifica se todo {% url 'nome' %} nos templates aponta para uma rota existente."""
import os
import re
import sys
from pathlib import Path

# Raiz do projeto (pasta acima de scripts/), garante imports e caminhos corretos.
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SmartLearning.settings')

import django

django.setup()

from django.urls import get_resolver

# Coleta todos os nomes de rota registrados.
all_names = set()


def extract_names(patterns):
    for p in patterns:
        if hasattr(p, 'name') and p.name:
            all_names.add(p.name)
        if hasattr(p, 'url_patterns'):
            extract_names(p.url_patterns)


extract_names(get_resolver().url_patterns)

# Coleta os nomes usados em {% url '...' %} nos templates.
urls_in_templates = set()
templates_dir = BASE_DIR / 'templates'
for root, _, files in os.walk(templates_dir):
    for file in files:
        if file.endswith('.html'):
            content = open(os.path.join(root, file), encoding='utf-8').read()
            for m in re.findall(r'{%\s*url\s+[\'"]([^\'"]+)[\'"]', content):
                urls_in_templates.add((m, os.path.join(root, file)))

# Aponta as rotas referenciadas que não existem.
broken = [(n, f) for n, f in urls_in_templates if n not in all_names]

if broken:
    for name, filepath in broken:
        print(f"URL quebrada '{name}' em {filepath}")
else:
    print("Nenhuma URL quebrada encontrada.")
