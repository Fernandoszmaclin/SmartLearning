# SmartLearning

App de estudos em Django 6: workspace de anotações estilo Notion, timer Pomodoro,
cursos e uma área acadêmica (estudos / trabalhos / provas) com painel "Minha área".

## Rodar localmente

```bash
# 1. ambiente virtual
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

# 2. dependências
pip install -r requirements.txt

# 3. variáveis de ambiente
cp .env.example .env   # e edite os valores

# 4. banco e servidor
python manage.py migrate
python manage.py runserver
```

Abra http://127.0.0.1:8000. Crie um usuário em `/signup/` ou um superusuário com
`python manage.py createsuperuser`.

## Configuração (.env)

| Variável | Descrição |
| --- | --- |
| `DJANGO_SECRET_KEY` | Chave secreta. Gere com `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DJANGO_DEBUG` | `True` em dev, `False` em produção |
| `DJANGO_ALLOWED_HOSTS` | Hosts separados por vírgula (produção) |
