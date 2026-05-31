# Referência visual do SmartLearning

O CSS versionado define as cores, a tipografia e as medidas em uso. A folha
principal fica em `SmartLearning/static/css/base/main.css`. Nas versões
anteriores à reorganização do frontend, ela fica em `static/css/main.css`
dentro do projeto Django. Consulte o seletor do tema ativo antes de alterar
uma cor que também aparece em painéis, formulários ou no editor.

## Área de estudos

O workspace mantém a árvore de páginas, o editor e o Pomodoro no mesmo
ambiente. Ao ajustar o layout, verifique a leitura do editor com a árvore
aberta e recolhida. Confira também o estado de foco dos controles do timer
e dos botões de bloco. Os ícones reutilizados pela interface ficam no
template `_icons.html` nas versões que incluem esse arquivo.

## Área acadêmica

O calendário, a lista de matérias e o painel compartilham informações de
prazo e conclusão. Uma mudança de cor nesses estados deve manter legíveis
os rótulos e as datas nos temas claro e escuro. Para mudanças de layout,
confira o calendário e o workspace em uma janela estreita e navegue pelos
controles com o teclado.
