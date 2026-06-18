<h1 align="center">SmartLearning</h1>

<p align="center">
  Ambiente unificado de estudos com workspace estilo Notion, timer Pomodoro integrado, gestão acadêmica e planejador semanal. Construído com Django e Vanilla JS/CSS, sem framework de frontend.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-ES2023-F7DF1E?logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/SQLite%20%7C%20PostgreSQL-ready-003B57?logo=sqlite&logoColor=white" />
</p>

## Sobre o projeto

O SmartLearning nasceu da vontade de juntar toda a rotina acadêmica em um lugar só: editor de notas, controle de prazos, timer de foco e um panorama do progresso, sem precisar pular entre três apps diferentes.

A ideia foi manter a stack enxuta. Django cuida do back-end e o front é feito em Vanilla JS/CSS, sem bundler nem biblioteca de componentes. Toda a parte interativa (navegação SPA, drag & drop, editor de blocos) foi construída em cima das APIs nativas do browser.

## Funcionalidades

### Workspace (editor estilo Notion)
- Editor baseado em blocos independentes: parágrafo, títulos, todo, lista, quote, código, divisor e arquivo.
- Drag & drop entre blocos com a ordem salva automaticamente.
- Hierarquia de páginas e pastas com aninhamento ilimitado na barra lateral.
- Favoritos, ícone por emoji e vínculo de matéria por página.
- Navegação SPA: troca de páginas sem recarregar, mantendo sidebar e Pomodoro.
- Exportação de página em Markdown e backup completo em JSON.

### Hub Acadêmico
- Gestão de matérias (nome, professor, cor) com painel de anotações e estudos.
- Anotações do tipo Trabalho e Prova com prazo, dificuldade, tempo estimado e status.
- Calendário mensal de prazos.
- Planejador semanal que distribui as tarefas pendentes nos próximos 7 dias por urgência e dificuldade, respeitando o tempo disponível de cada dia.
- Anotação acadêmica que pode ser vinculada a uma página do workspace.

### Pomodoro
- Timer com modos Focus, Short Break e Long Break configuráveis.
- Sessões salvas e vinculadas à página aberta no momento.
- Painel diário com as sessões e os minutos de foco do dia.
- Heatmap de atividade estilo GitHub no dashboard.

### Busca global
- Pesquisa unificada em páginas, blocos, anotações acadêmicas e matérias.
- Destaque nos trechos encontrados, com um pequeno contexto.
- Endpoint JSON para integrações (`?format=json`).

## Stack técnica

| Camada | Tecnologias |
|--------|-------------|
| Back-end | Python 3.14, Django 6.0, SQLite (dev) / PostgreSQL (prod) |
| Front-end | HTML5, Vanilla JS (ES2023), Vanilla CSS |
| Segurança | CSRF, Content-Security-Policy, X-Frame-Options, validação de upload e proteção contra open redirect |
| Testes | 50+ testes cobrindo views, APIs, isolamento por usuário e XSS |

## Rodando localmente

```bash
git clone https://github.com/Fernandoszmaclin/SmartLearning.git
cd SmartLearning

python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env   # edite as variáveis conforme necessário

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Acesse `http://127.0.0.1:8000/`.

### Variáveis de ambiente (`.env`)

| Variável | Padrão (dev) | Descrição |
|----------|-------------|-----------|
| `DJANGO_SECRET_KEY` | gerado automaticamente em dev | Obrigatório em produção |
| `DJANGO_DEBUG` | `True` | Defina `False` em produção |
| `DJANGO_ALLOWED_HOSTS` | vazio | Hosts permitidos (separados por vírgula) |

### Rodando os testes

```bash
python manage.py test
```
