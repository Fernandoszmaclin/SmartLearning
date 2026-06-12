<h1 align="center">SmartLearning</h1>

<p align="center">
  Ambiente unificado de estudos — workspace estilo Notion, timer Pomodoro integrado, gestão acadêmica e planejador semanal, construído com Django e Vanilla JS/CSS sem nenhum framework de frontend.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.14-3776AB?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-ES2023-F7DF1E?logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/SQLite%20%7C%20PostgreSQL-ready-003B57?logo=sqlite&logoColor=white" />
</p>

---

## Sobre o projeto

SmartLearning surgiu da necessidade de concentrar toda a rotina acadêmica em uma ferramenta só: editor de notas, controle de prazos, timer de foco e panorama de progresso — sem depender de três apps diferentes.

O foco técnico foi manter a stack no mínimo necessário: **Django no back-end**, **Vanilla JS/CSS no front-end**, sem bundler, sem framework de componentes. Toda a riqueza interativa — navegação SPA, drag & drop, editor de blocos — foi construída sobre APIs nativas do browser.

---

## Funcionalidades

### Workspace (editor estilo Notion)
- Editor baseado em **blocos** independentes: parágrafo, títulos (H1–H3), todo, lista, quote, código, divisor e arquivo.
- Drag & drop nativo entre blocos com reordenação persistida via API REST.
- Hierarquia de páginas e pastas (aninhamento ilimitado) gerenciada na barra lateral.
- Favoritos, ícone por emoji e vínculo por matéria por página.
- **Navegação SPA** via History API: troca de páginas sem reload, com sidebar e Pomodoro persistentes.
- Exportação de página como Markdown e backup completo em JSON.

### Hub Acadêmico
- Gestão de **matérias** (nome, professor, cor) com painel de anotações e estudos vinculados.
- Anotações do tipo **Trabalho** e **Prova** com prazo, dificuldade, tempo estimado e status de conclusão.
- **Calendário mensal** de prazos integrado.
- **Planejador semanal automático**: distribui tarefas pendentes nos próximos 7 dias por urgência × dificuldade, respeitando o tempo disponível por dia configurado pelo usuário.
- Anotação acadêmica vinculável a uma página do workspace.

### Pomodoro
- Timer com modos Focus / Short Break / Long Break configuráveis.
- Sessões salvas no banco e vinculadas à página aberta no momento — funciona corretamente após navegação SPA.
- Painel diário: sessões e minutos de foco do dia exibidos no editor.
- **Heatmap de atividade estilo GitHub** (26 semanas) no dashboard.

### Busca global
- Pesquisa unificada em páginas do workspace, blocos, anotações acadêmicas e matérias.
- Destaque (`<mark>`) nos trechos encontrados, com snippet contextual.
- Endpoint JSON para integrações (`?format=json`).

---

## Stack técnica

| Camada | Tecnologias |
|--------|-------------|
| Back-end | Python 3.14, Django 6.0, SQLite (dev) / PostgreSQL (prod) |
| Front-end | HTML5, Vanilla JS (ES2023), Vanilla CSS — sem bundler |
| Segurança | CSRF, `Content-Security-Policy`, `X-Frame-Options`, validação de upload (tipo + tamanho), proteção contra open redirect |
| Testes | `django.test.TestCase` — 50+ testes cobrindo views, APIs, isolamento por usuário e XSS |

---

## Destaques de implementação

**SPA com History API pura** — `fetch` + `DOMParser` + `replaceChildren`, sem biblioteca. `AbortController` garante que somente a navegação mais recente completa. `flushPendingSaves()` envia saves pendentes antes de trocar de página, evitando perda de digitação. Inserção de HTML via `replaceChildren` não executa `<script>` tags (comportamento especificado), eliminando XSS por injeção de HTML remoto.

**Editor de blocos sem framework** — saves são debounced por bloco individualmente (`Map<id, timer>`), então digitar no bloco B não cancela o save pendente do bloco A. Operações assíncronas (criar/duplicar bloco) verificam `isConnected` no DOM antes de inserir, evitando race conditions com navegação SPA.

**Planejador semanal algorítmico** — scoring `urgência × dificuldade` com first-fit e fallback para o dia de menor carga, respeitando deadline por tarefa.

**Heatmap de atividade** — gerado no servidor em Python puro (`Counter` + `timedelta`), 26 semanas × 7 dias, com intensidade 0–4 e rótulos de mês dinâmicos.

---

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
| `DJANGO_SECRET_KEY` | gerado automaticamente em dev | **Obrigatório em produção** |
| `DJANGO_DEBUG` | `True` | Defina `False` em produção |
| `DJANGO_ALLOWED_HOSTS` | vazio | Hosts permitidos (separados por vírgula) |

### Rodando os testes

```bash
python manage.py test
```

---

## Estrutura do projeto

```
SmartLearning/          ← raiz do projeto Django
├── SmartLearning/      ← configurações, URLs globais, views de busca e auth
├── notes/              ← workspace: páginas, blocos, exportação
├── academics/          ← matérias, anotações, calendário, planejador semanal
├── pomodoro/           ← timer e histórico de sessões de foco
├── profiles/           ← perfil de usuário
├── static/
│   ├── css/            ← estilos por página (Vanilla CSS)
│   └── js/             ← scripts por página (Vanilla JS)
└── templates/          ← templates Django (server-side rendering + SPA swap)
```
