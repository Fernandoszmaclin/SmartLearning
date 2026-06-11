<h1 align="center">
  SmartLearning 📚
</h1>

<p align="center">
  Um ambiente unificado para organizar sua rotina de estudos, gerenciar projetos acadêmicos e manter o foco. Tudo num só lugar, sem distrações.
</p>

<p align="center">
  <!-- Recomendo substituir a imagem abaixo por um print real do seu sistema rodando! -->
  <img src="https://via.placeholder.com/1000x500.png?text=Preview+do+SmartLearning+(Substitua+por+um+print+real!)" alt="SmartLearning Preview" width="100%" />
</p>

## O que é o SmartLearning?

O **SmartLearning** nasceu da necessidade de concentrar a vida acadêmica e produtiva em uma única ferramenta rápida e agradável de usar. Ao invés de usar um app para Pomodoro, outro para gerenciar matérias da faculdade e um terceiro como bloco de notas estilo Notion, o SmartLearning centraliza tudo isso.

A ideia é oferecer uma interface fluida, rápida (sem frameworks pesados) e bonita, focando no que realmente importa: **organização e estudo**.

## Principais Funcionalidades

✨ **Workspace Flexível (Estilo Notion)**
* Um editor baseado em blocos (texto, todos, divisores, arquivos) para criar anotações ricas.
* Arraste e solte (Drag & Drop) intuitivo para organizar pastas e páginas na sua barra lateral.
* Comandos rápidos usando a barra (`/`) para inserir novos elementos sem tirar as mãos do teclado.

🎓 **Hub Acadêmico**
* Gestão completa de disciplinas, professores e acompanhamento do semestre.
* Organização de provas e trabalhos com status de progresso, prazos de entrega e nível de dificuldade.
* Calendário e planejador semanal integrados para não perder nenhum prazo.

🍅 **Pomodoro Integrado**
* Timer Pomodoro nativo que registra automaticamente o seu tempo de foco diário.
* Link direto entre sessões de estudo e páginas do workspace: acompanhe quanto tempo você dedicou a cada anotação ou matéria.

🎨 **Design Premium & Fluido**
* Desenvolvido com Vanilla CSS focado em micro-interações, tipografia moderna e paleta de cores balanceada.
* Suporte nativo e instantâneo a Dark Mode / Light Mode.
* Navegação responsiva e limpa.

## Tecnologias Utilizadas

Este projeto tem orgulho de usar uma stack robusta no back-end e manter a simplicidade e a performance no front-end:

* **Back-end:** Python & Django (autenticação, segurança, ORM, roteamento).
* **Front-end:** HTML5, Vanilla JavaScript (ES6+), e Vanilla CSS moderno.
* **Banco de Dados:** SQLite (padrão) / PostgreSQL (pronto para produção).

## Como rodar localmente

Se você quiser testar ou contribuir, o processo de setup é super direto:

1. Clone este repositório:
   ```bash
   git clone https://github.com/seu-usuario/SmartLearning.git
   cd SmartLearning
   ```

2. Crie seu ambiente virtual (opcional, mas recomendado) e instale as dependências:
   ```bash
   python -m venv venv
   source venv/bin/activate  # ou no Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Configure o banco de dados e faça as migrações:
   ```bash
   python manage.py migrate
   ```

4. Crie um superusuário para ter acesso de administrador:
   ```bash
   python manage.py createsuperuser
   ```

5. Rode o servidor:
   ```bash
   python manage.py runserver
   ```
   Acesse `http://127.0.0.1:8000/` no seu navegador e bons estudos!

---

💡 **Nota do desenvolvedor:** A interface foi construída para parecer "viva" e interativa. Se quiser colaborar em melhorias de acessibilidade ou adicionar novos blocos no editor de texto, sinta-se em casa para abrir uma Pull Request!
