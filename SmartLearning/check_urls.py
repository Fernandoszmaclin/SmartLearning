import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SmartLearning.settings')
django.setup()

from django.urls import get_resolver

resolver = get_resolver()
all_names = set()

def extract_names(patterns, prefix=''):
    for p in patterns:
        if hasattr(p, 'name') and p.name:
            all_names.add(p.name)
        if hasattr(p, 'url_patterns'):
            extract_names(p.url_patterns)

extract_names(resolver.url_patterns)

urls_in_templates = set()
for root, _, files in os.walk('templates'):
    for file in files:
        if file.endswith('.html'):
            content = open(os.path.join(root, file), encoding='utf-8').read()
            # find {% url 'name' ... %} or {% url "name" ... %}
            matches = re.findall(r'{%\s*url\s+[\'"]([^\'"]+)[\'"]', content)
            for m in matches:
                urls_in_templates.add((m, os.path.join(root, file)))

broken = []
for name, filepath in urls_in_templates:
    if name not in all_names:
        broken.append((name, filepath))

if broken:
    for name, filepath in broken:
        print(f"Broken URL '{name}' in {filepath}")
else:
    print("No broken URLs found.")
