**Objetivo**
- Recriar a página com a mesma intenção funcional da versão antiga.
- Corrigir fragilidades da lógica legada.
- Tornar o cálculo de pendências determinístico, auditável e fácil de evoluir.
- Entregar em releases pequenas para reduzir risco.

**Princípios**
- Fonte única de verdade para os dados.
- Normalização forte de status, nomes, procedimentos e datas.
- Cálculo previsível, sem dependência de gambiarras de UI.
- Filtros e contadores sempre derivados do mesmo motor de dados.
- Cada release deve terminar com validação funcional e técnica.

**Plano por Release**

**0.2.8 - Fundação da página**
- Criar a estrutura da página.
- Definir os contratos de dados que a página vai consumir.
- Separar:
  - carregamento dos dados
  - normalização
  - cálculo de pendências
  - renderização
- Criar estado inicial vazio com skeleton/loading.
- Garantir que a página abre sem depender de dados completos.

Entrega:
- Página criada.
- Layout base.
- Estrutura de estado e serviços montada.
- Sem lógica complexa ainda.

**0.2.9 - Motor de normalização**
- Criar um normalizador central para:
  - status
  - nomes de pacientes
  - procedimentos
  - datas
  - identificadores duplicados
- Tratar variações de acento, caixa, espaços e campos vazios.
- Definir regras de equivalência entre status antigos e novos.
- Criar chaves estáveis para agrupamento.

Entrega:
- Dados comparáveis de forma consistente.
- Base para evitar duplicidades falsas.
- Preparação para cálculo preciso.

**0.3.0 - Regra oficial de pendência**
- Reescrever a lógica de “pendente” com regras explícitas.
- Separar o que é:
  - elegível para evolução
  - já evoluído
  - ignorado
  - inválido
- Definir precedência de regras.
- Garantir que a mesma entrada sempre gere a mesma saída.

Sugestão de regra-base:
- incluir apenas atendimentos confirmados elegíveis;
- excluir os já registrados como evoluídos;
- excluir cancelados, inválidos ou sem vínculo suficiente;
- resolver duplicidades por chave canônica.

Entrega:
- Motor de pendências confiável.
- Regras documentadas no próprio código.
- Menos dependência de interpretação visual.

**0.3.1 - Agrupamento e contagem**
- Agrupar pendências por paciente.
- Agrupar pendências por procedimento/especialidade.
- Contabilizar:
  - total geral
  - total por paciente
  - total por procedimento
  - total por período
- Definir desempate para casos ambíguos.
- Padronizar ordenação.

Entrega:
- Visões resumidas consistentes.
- Contadores confiáveis.
- Base para cards e listas.

**0.3.2 - UI funcional**
- Construir a interface principal:
  - cards de resumo
  - lista de pacientes
  - lista por procedimento
  - busca global
  - filtro por período
  - modal de detalhes
- Mostrar claramente o motivo de cada item estar pendente.
- Exibir estado vazio com orientação útil.
- Melhorar leitura visual e hierarquia de informação.

Entrega:
- Página utilizável de ponta a ponta.
- Interface clara e objetiva.
- Detalhes acessíveis sem poluir a visão principal.

**0.3.3 - Precisão avançada**
- Adicionar regras de exceção e refinamento:
  - múltiplos atendimentos no mesmo dia
  - evolução já realizada em parte
  - procedimento com nome parecido mas não igual
  - reabertura de atendimento
  - registros duplicados importados
- Implementar rastreabilidade do porquê um item entrou ou saiu da fila.
- Exibir “motivo de inclusão” e “motivo de exclusão” em debug interno.

Entrega:
- Sistema mais preciso.
- Menos falsos positivos e falsos negativos.
- Melhor confiança operacional.

**0.3.4 - Auditoria e consistência**
- Criar validações automáticas:
  - dados sem data
  - status desconhecido
  - paciente sem nome confiável
  - procedimento inconsistente
- Criar logs internos ou painel técnico de auditoria.
- Detectar divergência entre contadores e listas.
- Garantir reprocessamento idempotente.

Entrega:
- Página mais segura para operação real.
- Diagnóstico mais rápido de inconsistências.
- Menos risco de erro silencioso.

**0.3.5 - Performance e escala**
- Otimizar renderização.
- Evitar recomputação desnecessária.
- Trabalhar com cache de resultado quando os dados não mudarem.
- Garantir boa performance com base grande.
- Separar cálculos pesados da UI.

Entrega:
- Página rápida mesmo com volume alto.
- Menos travamentos.
- Melhor experiência em máquinas modestas.

**0.3.6 - QA e validação**
- Testar cenários reais e bordas:
  - ausência de dados
  - duplicados
  - nomes parecidos
  - procedimentos múltiplos
  - status misturados
  - dados antigos e novos juntos
- Validar contagens contra amostras conhecidas.
- Comparar comportamento com a lógica antiga.
- Ajustar regressões.

Entrega:
- Confiança de produção.
- Casos críticos cobertos.
- Lógica validada contra a referência histórica.

**0.3.7 - Polimento final e release**
- Revisar microcopy.
- Ajustar acessibilidade.
- Revisar estados vazios e loading.
- Atualizar versão.
- Registrar o que mudou em relação ao legado.
- Preparar rollout final.

Entrega:
- Versão estável.
- Página pronta para uso real.
- Histórico de decisões consolidado.

**Critérios de sucesso**
- O número de pendências bate com os dados de origem.
- Não há duplicidade artificial.
- O usuário entende por que cada item aparece.
- A página continua correta mesmo com dados imperfeitos.
- Mudanças futuras ficam fáceis de implementar.

**Ordem recomendada de execução**
1. Motor de normalização.
2. Regra oficial de pendência.
3. Agrupamento e contagem.
4. UI funcional.
5. Precisão avançada.
6. Auditoria.
7. Performance.
8. QA.
9. Release final.

**Observação técnica**
- A lógica antiga serve como referência funcional, não como implementação final.
- O novo fluxo deve ser mais explícito e menos dependente de suposições.
- O ideal é que a página nova consiga explicar cada item pendente com base em regras, não só exibir listas.


