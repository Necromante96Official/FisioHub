/**
 * ZENFISIO COLLECTOR v0.4.3
 * Sistema de coleta automatica de dados de agendamentos
 * Atalho: Ctrl+Shift+X para ativar/desativar
 * Anti-duplicação melhorado
 */

(function() {
    'use strict';

    // Evitar duplicacao
    if (window.ZenfisioCollectorLoaded) return;
    window.ZenfisioCollectorLoaded = true;

    // ========================================
    // CONFIGURACOES
    // ========================================
    var CONFIG = {
        version: '0.4.3',
        storageKey: 'zenfisio_collector_data',
        activeStorageKey: 'zenfisio_collector_active',
        popupCheckDelay: 500,
        duplicateBlockTime: 5000,  // Tempo para bloquear duplicatas (5 segundos)
        maxRecentIds: 50          // Máximo de IDs recentes a guardar
    };

    // ========================================
    // ESTADO DA APLICACAO
    // ========================================
    var state = {
        isActive: false,
        isMonitoring: false,
        collectedData: [],
        recentCollectedIds: [],    // Array de IDs recentes com timestamp
        observer: null,
        isMinimized: false,
        isCollecting: false        // Flag para evitar coletas simultâneas
    };

    // ========================================
    // INICIALIZACAO
    // ========================================
    function init() {
        console.log('[ZFC] Zenfisio Collector v' + CONFIG.version + ' carregado!');
        console.log('[ZFC] Pressione Ctrl+Shift+X para ativar/desativar');
        
        // Carregar estado salvo
        loadActiveState();
        
        // Configurar atalho de teclado
        setupKeyboardShortcut();
        
        // Se estava ativo, restaurar
        if (state.isActive) {
            loadSavedData();
            createUI();
            showActivationNotification(true);
        }
    }

    // ========================================
    // ATALHO DE TECLADO - CTRL+SHIFT+X
    // ========================================
    function setupKeyboardShortcut() {
        document.addEventListener('keydown', function(e) {
            // Ctrl + Shift + X
            if (e.ctrlKey && e.shiftKey && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                toggleCollector();
            }
        });
    }

    /**
     * Alterna entre ativo/inativo
     */
    function toggleCollector() {
        state.isActive = !state.isActive;
        saveActiveState();
        
        if (state.isActive) {
            // Ativar
            loadSavedData();
            createUI();
            showActivationNotification(true);
            console.log('[ZFC] ✅ Collector ATIVADO');
        } else {
            // Desativar
            if (state.isMonitoring) {
                stopMonitoring();
            }
            removeUI();
            showActivationNotification(false);
            console.log('[ZFC] ❌ Collector DESATIVADO');
        }
    }

    /**
     * Remove a UI do collector
     */
    function removeUI() {
        var panel = document.getElementById('zfc-panel');
        if (panel) {
            panel.remove();
        }
        var styles = document.getElementById('zfc-styles');
        if (styles) {
            styles.remove();
        }
    }

    /**
     * Mostra notificação de ativação/desativação
     */
    function showActivationNotification(isActivating) {
        // Remover notificação anterior se existir
        var existingNotif = document.getElementById('zfc-activation-notif');
        if (existingNotif) existingNotif.remove();
        
        var notif = document.createElement('div');
        notif.id = 'zfc-activation-notif';
        notif.style.cssText = '\
            position: fixed !important;\
            top: 50% !important;\
            left: 50% !important;\
            transform: translate(-50%, -50%) scale(0.8) !important;\
            background: ' + (isActivating ? '#10b981' : '#ef4444') + ' !important;\
            color: white !important;\
            padding: 20px 40px !important;\
            border-radius: 16px !important;\
            font-size: 18px !important;\
            font-weight: 600 !important;\
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;\
            z-index: 2147483647 !important;\
            box-shadow: 0 20px 60px rgba(0,0,0,0.4) !important;\
            opacity: 0 !important;\
            transition: all 0.3s ease !important;\
        ';
        notif.innerHTML = '\
            <div style="display: flex; align-items: center; gap: 12px;">\
                <span style="font-size: 28px;">' + (isActivating ? '✅' : '❌') + '</span>\
                <div>\
                    <div style="font-size: 14px; opacity: 0.8;">Zenfisio Collector</div>\
                    <div>' + (isActivating ? 'ATIVADO' : 'DESATIVADO') + '</div>\
                </div>\
            </div>\
            <div style="font-size: 11px; margin-top: 10px; opacity: 0.7;">Ctrl+Shift+X para alternar</div>\
        ';
        
        document.body.appendChild(notif);
        
        // Animar entrada
        setTimeout(function() {
            notif.style.opacity = '1';
            notif.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 10);
        
        // Remover após 1.5s
        setTimeout(function() {
            notif.style.opacity = '0';
            notif.style.transform = 'translate(-50%, -50%) scale(0.8)';
            setTimeout(function() {
                if (notif.parentNode) notif.remove();
            }, 300);
        }, 1500);
    }

    /**
     * Salva o estado ativo no localStorage
     */
    function saveActiveState() {
        try {
            localStorage.setItem(CONFIG.activeStorageKey, state.isActive ? 'true' : 'false');
        } catch (e) {
            console.error('[ZFC] Erro ao salvar estado:', e);
        }
    }

    /**
     * Carrega o estado ativo do localStorage
     */
    function loadActiveState() {
        try {
            var saved = localStorage.getItem(CONFIG.activeStorageKey);
            state.isActive = saved === 'true';
        } catch (e) {
            state.isActive = false;
        }
    }

    // ========================================
    // INTERFACE DO USUARIO - UNICO PAINEL
    // ========================================
    function createUI() {
        // Remover elementos existentes se houver
        var existingPanel = document.getElementById('zfc-panel');
        if (existingPanel) existingPanel.remove();

        // Container principal
        var container = document.createElement('div');
        container.id = 'zfc-panel';
        container.innerHTML = '\
            <div class="zfc-header" id="zfc-header">\
                <div class="zfc-title">\
                    <span class="zfc-logo">ZF</span>\
                    <span>Collector</span>\
                    <span class="zfc-version">v' + CONFIG.version + '</span>\
                </div>\
                <button class="zfc-btn-minimize" id="zfc-minimize" title="Minimizar">_</button>\
            </div>\
            <div class="zfc-body" id="zfc-body">\
                <div class="zfc-status-bar">\
                    <div class="zfc-status" id="zfc-status">\
                        <span class="zfc-dot"></span>\
                        <span class="zfc-status-text">Parado</span>\
                    </div>\
                    <div class="zfc-count" id="zfc-count">0</div>\
                </div>\
                <div class="zfc-actions">\
                    <button class="zfc-btn zfc-btn-start" id="zfc-start">Iniciar</button>\
                    <button class="zfc-btn zfc-btn-stop" id="zfc-stop" disabled>Parar</button>\
                </div>\
                <div class="zfc-actions">\
                    <button class="zfc-btn zfc-btn-save" id="zfc-save">Salvar TXT</button>\
                    <button class="zfc-btn zfc-btn-copy" id="zfc-copy">Copiar</button>\
                </div>\
                <button class="zfc-btn zfc-btn-clear" id="zfc-clear">Limpar Dados</button>\
                <div class="zfc-preview">\
                    <div class="zfc-preview-title">Ultimo coletado:</div>\
                    <div class="zfc-preview-content" id="zfc-preview-content">Nenhum dado coletado ainda...</div>\
                </div>\
            </div>\
        ';
        document.body.appendChild(container);

        // Injetar estilos inline para garantir funcionamento
        injectStyles();

        // Adicionar eventos
        attachEventListeners();

        // Atualizar status inicial
        updateStatusUI(state.isMonitoring);

        // Atualizar contador
        updateCountUI();
    }

    function injectStyles() {
        if (document.getElementById('zfc-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'zfc-styles';
        style.textContent = '\
            #zfc-panel { \
                position: fixed !important; \
                top: 20px !important; \
                right: 20px !important; \
                width: 280px !important; \
                background: #1e293b !important; \
                border-radius: 12px !important; \
                box-shadow: 0 10px 40px rgba(0,0,0,0.4) !important; \
                z-index: 2147483647 !important; \
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; \
                font-size: 14px !important; \
                color: #f8fafc !important; \
                border: 1px solid #475569 !important; \
                overflow: hidden !important; \
            } \
            #zfc-panel.minimized .zfc-body { display: none !important; } \
            #zfc-panel.minimized { width: auto !important; } \
            #zfc-panel .zfc-header { \
                display: flex !important; \
                align-items: center !important; \
                justify-content: space-between !important; \
                padding: 12px 16px !important; \
                background: linear-gradient(135deg, #ef4444, #dc2626) !important; \
                cursor: grab !important; \
                user-select: none !important; \
                transition: background 0.3s ease !important; \
            } \
            #zfc-panel .zfc-title { \
                display: flex !important; \
                align-items: center !important; \
                gap: 8px !important; \
                font-weight: 600 !important; \
                color: white !important; \
            } \
            #zfc-panel .zfc-logo { \
                background: rgba(255,255,255,0.2) !important; \
                padding: 4px 8px !important; \
                border-radius: 6px !important; \
                font-weight: 700 !important; \
                font-size: 12px !important; \
            } \
            #zfc-panel .zfc-version { \
                font-size: 10px !important; \
                opacity: 0.7 !important; \
            } \
            #zfc-panel .zfc-btn-minimize { \
                background: rgba(255,255,255,0.2) !important; \
                border: none !important; \
                color: white !important; \
                width: 28px !important; \
                height: 28px !important; \
                border-radius: 6px !important; \
                cursor: pointer !important; \
                font-size: 16px !important; \
                font-weight: bold !important; \
                display: flex !important; \
                align-items: center !important; \
                justify-content: center !important; \
            } \
            #zfc-panel .zfc-btn-minimize:hover { background: rgba(255,255,255,0.3) !important; } \
            #zfc-panel .zfc-body { \
                padding: 16px !important; \
                display: flex !important; \
                flex-direction: column !important; \
                gap: 12px !important; \
            } \
            #zfc-panel .zfc-status-bar { \
                display: flex !important; \
                align-items: center !important; \
                justify-content: space-between !important; \
                padding: 10px 12px !important; \
                background: #334155 !important; \
                border-radius: 8px !important; \
            } \
            #zfc-panel .zfc-status { \
                display: flex !important; \
                align-items: center !important; \
                gap: 8px !important; \
            } \
            #zfc-panel .zfc-dot { \
                width: 10px !important; \
                height: 10px !important; \
                border-radius: 50% !important; \
                background: #94a3b8 !important; \
            } \
            #zfc-panel .zfc-status.active .zfc-dot { \
                background: #10b981 !important; \
                box-shadow: 0 0 8px #10b981 !important; \
            } \
            #zfc-panel .zfc-status-text { font-size: 13px !important; color: #94a3b8 !important; } \
            #zfc-panel .zfc-status.active .zfc-status-text { color: #10b981 !important; font-weight: 500 !important; } \
            #zfc-panel .zfc-count { \
                background: #10b981 !important; \
                color: white !important; \
                font-weight: 700 !important; \
                padding: 4px 12px !important; \
                border-radius: 20px !important; \
                font-size: 14px !important; \
            } \
            #zfc-panel .zfc-actions { display: flex !important; gap: 8px !important; } \
            #zfc-panel .zfc-btn { \
                flex: 1 !important; \
                padding: 10px 12px !important; \
                border: none !important; \
                border-radius: 8px !important; \
                cursor: pointer !important; \
                font-size: 13px !important; \
                font-weight: 500 !important; \
                color: white !important; \
                transition: all 0.2s !important; \
            } \
            #zfc-panel .zfc-btn:disabled { opacity: 0.5 !important; cursor: not-allowed !important; } \
            #zfc-panel .zfc-btn-start { background: #10b981 !important; } \
            #zfc-panel .zfc-btn-start:hover:not(:disabled) { background: #059669 !important; } \
            #zfc-panel .zfc-btn-stop { background: #ef4444 !important; } \
            #zfc-panel .zfc-btn-stop:hover:not(:disabled) { background: #dc2626 !important; } \
            #zfc-panel .zfc-btn-save { background: #3b82f6 !important; } \
            #zfc-panel .zfc-btn-save:hover { background: #2563eb !important; } \
            #zfc-panel .zfc-btn-copy { background: #475569 !important; } \
            #zfc-panel .zfc-btn-copy:hover { background: #64748b !important; } \
            #zfc-panel .zfc-btn-clear { \
                background: transparent !important; \
                border: 1px solid #475569 !important; \
                color: #94a3b8 !important; \
            } \
            #zfc-panel .zfc-btn-clear:hover { \
                background: #ef4444 !important; \
                border-color: #ef4444 !important; \
                color: white !important; \
            } \
            #zfc-panel .zfc-preview { \
                background: #334155 !important; \
                border-radius: 8px !important; \
                overflow: hidden !important; \
            } \
            #zfc-panel .zfc-preview-title { \
                padding: 8px 12px !important; \
                background: #475569 !important; \
                font-size: 11px !important; \
                text-transform: uppercase !important; \
                color: #94a3b8 !important; \
            } \
            #zfc-panel .zfc-preview-content { \
                padding: 12px !important; \
                font-size: 12px !important; \
                white-space: pre-wrap !important; \
                max-height: 120px !important; \
                overflow-y: auto !important; \
                line-height: 1.5 !important; \
            } \
            .zfc-notification { \
                position: fixed !important; \
                bottom: 20px !important; \
                right: 20px !important; \
                padding: 12px 20px !important; \
                border-radius: 8px !important; \
                color: white !important; \
                font-size: 14px !important; \
                font-weight: 500 !important; \
                z-index: 2147483647 !important; \
                opacity: 0 !important; \
                transform: translateY(20px) !important; \
                transition: all 0.3s !important; \
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; \
            } \
            .zfc-notification.show { opacity: 1 !important; transform: translateY(0) !important; } \
            .zfc-notification-success { background: #10b981 !important; } \
            .zfc-notification-error { background: #ef4444 !important; } \
            .zfc-notification-info { background: #3b82f6 !important; } \
        ';
        document.head.appendChild(style);
    }

    function attachEventListeners() {
        // Botoes
        document.getElementById('zfc-start').onclick = startMonitoring;
        document.getElementById('zfc-stop').onclick = stopMonitoring;
        document.getElementById('zfc-save').onclick = saveToFile;
        document.getElementById('zfc-copy').onclick = copyToClipboard;
        document.getElementById('zfc-clear').onclick = clearData;
        document.getElementById('zfc-minimize').onclick = toggleMinimize;

        // Arrastar painel
        makeDraggable();
    }

    function makeDraggable() {
        var panel = document.getElementById('zfc-panel');
        var header = document.getElementById('zfc-header');
        var isDragging = false;
        var offsetX = 0;
        var offsetY = 0;

        header.onmousedown = function(e) {
            if (e.target.id === 'zfc-minimize') return;
            isDragging = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
            header.style.cursor = 'grabbing';
            e.preventDefault();
        };

        document.onmousemove = function(e) {
            if (!isDragging) return;
            var x = e.clientX - offsetX;
            var y = e.clientY - offsetY;
            x = Math.max(0, Math.min(x, window.innerWidth - panel.offsetWidth));
            y = Math.max(0, Math.min(y, window.innerHeight - panel.offsetHeight));
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';
            panel.style.right = 'auto';
        };

        document.onmouseup = function() {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'grab';
            }
        };
    }

    function toggleMinimize() {
        var panel = document.getElementById('zfc-panel');
        var btn = document.getElementById('zfc-minimize');
        state.isMinimized = !state.isMinimized;
        
        if (state.isMinimized) {
            panel.classList.add('minimized');
            btn.textContent = '+';
            btn.title = 'Expandir';
        } else {
            panel.classList.remove('minimized');
            btn.textContent = '_';
            btn.title = 'Minimizar';
        }
    }

    // ========================================
    // MONITORAMENTO
    // ========================================
    function startMonitoring() {
        if (state.isMonitoring) return;
        
        state.isMonitoring = true;
        updateStatusUI(true);
        
        // Observar DOM
        state.observer = new MutationObserver(function(mutations) {
            if (!state.isMonitoring) return;
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        setTimeout(function() { checkNodeForPopup(node); }, CONFIG.popupCheckDelay);
                    }
                });
            });
        });
        state.observer.observe(document.body, { childList: true, subtree: true });

        // Cliques
        document.addEventListener('click', handleClick, true);
        
        console.log('[ZFC] Monitoramento iniciado!');
        showNotification('Monitoramento iniciado!', 'success');
    }

    function stopMonitoring() {
        if (!state.isMonitoring) return;
        
        state.isMonitoring = false;
        updateStatusUI(false);
        
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
        
        document.removeEventListener('click', handleClick, true);
        
        console.log('[ZFC] Monitoramento parado!');
        showNotification('Monitoramento parado!', 'info');
    }

    function handleClick(e) {
        if (!state.isMonitoring) return;
        if (e.target.closest('#zfc-panel')) return;
        setTimeout(checkForPopup, CONFIG.popupCheckDelay);
    }

    function checkForPopup() {
        var selectors = ['.popover', '.fc-popover', '.tooltip', '[role="dialog"]', '[role="tooltip"]', '.modal-content', '.MuiPopover-paper', '.MuiDialog-paper'];
        for (var i = 0; i < selectors.length; i++) {
            var popup = document.querySelector(selectors[i]);
            if (popup && isAppointmentPopup(popup)) {
                collectDataFromPopup(popup);
                return;
            }
        }
    }

    function checkNodeForPopup(node) {
        if (isAppointmentPopup(node)) {
            collectDataFromPopup(node);
            return;
        }
        var popup = node.querySelector && node.querySelector('.popover, .fc-popover, [role="dialog"], [role="tooltip"]');
        if (popup && isAppointmentPopup(popup)) {
            collectDataFromPopup(popup);
        }
    }

    function isAppointmentPopup(element) {
        if (!element || !element.textContent) return false;
        var text = element.textContent.toLowerCase();
        var keywords = ['paciente', 'fisioterapeuta', 'convenio', 'status', 'procedimento'];
        var count = 0;
        for (var i = 0; i < keywords.length; i++) {
            if (text.indexOf(keywords[i]) >= 0) count++;
        }
        return count >= 3;
    }

    // ========================================
    // COLETA DE DADOS - COM ANTI-DUPLICAÇÃO ROBUSTA
    // ========================================
    
    /**
     * Gera um ID único para o agendamento baseado em múltiplos campos
     */
    function generateUniqueId(data) {
        // Criar ID baseado em: paciente + horário + fisioterapeuta + procedimento
        var parts = [
            (data.paciente || '').trim().toLowerCase(),
            (data.horario || '').trim(),
            (data.fisioterapeuta || '').trim().toLowerCase().substring(0, 10),
            (data.procedimentos || '').trim().toLowerCase().substring(0, 20)
        ];
        return parts.join('|');
    }

    /**
     * Verifica se um ID foi coletado recentemente
     */
    function isRecentlyCollected(uniqueId) {
        var now = Date.now();
        
        // Limpar IDs antigos (mais de duplicateBlockTime)
        state.recentCollectedIds = state.recentCollectedIds.filter(function(item) {
            return (now - item.timestamp) < CONFIG.duplicateBlockTime;
        });
        
        // Verificar se existe
        for (var i = 0; i < state.recentCollectedIds.length; i++) {
            if (state.recentCollectedIds[i].id === uniqueId) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Marca um ID como coletado
     */
    function markAsCollected(uniqueId) {
        // Limitar tamanho do array
        if (state.recentCollectedIds.length >= CONFIG.maxRecentIds) {
            state.recentCollectedIds.shift(); // Remove o mais antigo
        }
        
        state.recentCollectedIds.push({
            id: uniqueId,
            timestamp: Date.now()
        });
    }

    /**
     * Verifica se os dados já existem na lista coletada
     */
    function isDuplicateInList(data) {
        var pacienteNovo = (data.paciente || '').trim().toLowerCase();
        var horarioNovo = (data.horario || '').trim();
        
        for (var i = 0; i < state.collectedData.length; i++) {
            var existente = state.collectedData[i].data;
            var pacienteExistente = (existente.paciente || '').trim().toLowerCase();
            var horarioExistente = (existente.horario || '').trim();
            
            // Se paciente E horário são iguais, é duplicata
            if (pacienteNovo === pacienteExistente && horarioNovo === horarioExistente) {
                return true;
            }
        }
        
        return false;
    }

    function collectDataFromPopup(popup) {
        // Proteção contra coletas simultâneas
        if (state.isCollecting) {
            console.log('[ZFC] Já coletando, aguarde...');
            return;
        }
        
        state.isCollecting = true;
        
        try {
            var data = extractData(popup);
            
            if (!data.paciente) {
                console.log('[ZFC] Popup sem paciente, ignorando...');
                state.isCollecting = false;
                return;
            }

            // Gerar ID único
            var uniqueId = generateUniqueId(data);
            
            // Verificação 1: ID coletado recentemente?
            if (isRecentlyCollected(uniqueId)) {
                console.log('[ZFC] Duplicata (coleta recente), ignorando:', data.paciente);
                state.isCollecting = false;
                return;
            }
            
            // Verificação 2: Já existe na lista?
            if (isDuplicateInList(data)) {
                console.log('[ZFC] Duplicata (já na lista), ignorando:', data.paciente);
                showNotification('⚠️ ' + data.paciente + ' já foi coletado', 'info');
                state.isCollecting = false;
                return;
            }
            
            // Marcar como coletado ANTES de adicionar
            markAsCollected(uniqueId);

            var formatted = formatData(data);
            state.collectedData.push({
                timestamp: new Date().toISOString(),
                data: data,
                formatted: formatted,
                uniqueId: uniqueId
            });

            updateCountUI();
            updatePreviewUI(formatted);
            saveToStorage();
            
            console.log('[ZFC] ✅ Coletado:', data.paciente);
            showNotification('✅ ' + data.paciente, 'success');
            
        } finally {
            // Liberar após um pequeno delay para evitar cliques muito rápidos
            setTimeout(function() {
                state.isCollecting = false;
            }, 300);
        }
    }

    function extractData(popup) {
        var data = {
            horario: '',
            fisioterapeuta: '',
            paciente: '',
            celular: '',
            convenio: '',
            status: '',
            procedimentos: '',
            valor: ''
        };

        var text = popup.textContent || popup.innerText || '';
        
        // Horario
        var horarioMatch = text.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
        if (horarioMatch) {
            data.horario = horarioMatch[1] + ' - ' + horarioMatch[2];
        }

        // Fisioterapeuta
        var fisioMatch = text.match(/Fisioterapeuta[:\s]+([^\n]+?)(?=\s*Paciente|$)/i);
        if (fisioMatch) data.fisioterapeuta = fisioMatch[1].trim();

        // Paciente
        var pacienteMatch = text.match(/Paciente[:\s]+([^\n]+?)(?=\s*Celular|\s*Telefone|$)/i);
        if (pacienteMatch) data.paciente = pacienteMatch[1].trim();

        // Celular
        var celularMatch = text.match(/(?:Celular|Telefone)[:\s]+([+\d\s().-]+)/i);
        if (celularMatch) data.celular = celularMatch[1].trim();

        // Convenio - parar antes de 'Status' ou 'Numero'
        var convenioMatch = text.match(/Conv[êe]nio[:\s]+([^\n]+?)(?=\s*Status|\s*N[uú]mero|$)/i);
        if (convenioMatch) {
            // Limpar texto extra que pode vir junto
            var conv = convenioMatch[1].trim();
            // Remover 'Numero do' se estiver no final
            conv = conv.replace(/N[uú]mero\s*(do|da)?\s*$/i, '').trim();
            data.convenio = conv;
        }

        // Procedimentos - Tentar várias formas de capturar
        var procMatch = text.match(/Procedimentos?[:\s]+([^\n]+?)(?=\s*Repetido|\s*\d{2}\/\d{2}\/\d{4}|\s*R\$|\s*Valor|$)/i);
        if (procMatch) {
            data.procedimentos = procMatch[1].trim();
            console.log('[ZFC] Procedimento encontrado:', data.procedimentos);
        } else {
            // Tentar formato alternativo: pode estar como "Procedimento(s): Texto"
            var procMatch2 = text.match(/Procedimento[s]?[:\s]+(.+?)(?=\n|$)/i);
            if (procMatch2) {
                data.procedimentos = procMatch2[1].trim();
                console.log('[ZFC] Procedimento encontrado (alt):', data.procedimentos);
            } else {
                console.log('[ZFC] ⚠️ Procedimento NÃO encontrado no texto');
            }
        }

        // Status - LER DO DOM, nao adivinhar!
        data.status = extractStatusFromDOM(popup);

        // Valor
        var valorMatch = text.match(/R\$\s*([\d.,]+)/);
        if (valorMatch) {
            data.valor = 'R$ ' + valorMatch[1];
        }

        // Limpar campos
        cleanData(data);
        
        return data;
    }

    /**
     * Extrai o status LENDO DIRETAMENTE do DOM
     * Prioridade: 
     * 1. Input radio/checkbox marcado
     * 2. Elemento com classe de selecionado
     * 3. Texto apos "Status:" como fallback
     */
    function extractStatusFromDOM(popup) {
        console.log('[ZFC] Buscando status no DOM...');
        
        // =====================================================
        // 1. BUSCAR RADIO BUTTONS E CHECKBOXES MARCADOS
        // =====================================================
        var checkedInputs = popup.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
        console.log('[ZFC] Inputs marcados encontrados:', checkedInputs.length);
        
        for (var i = 0; i < checkedInputs.length; i++) {
            var input = checkedInputs[i];
            var labelText = getLabelForInput(input, popup);
            console.log('[ZFC] Input marcado', i, '- Label:', labelText);
            
            if (labelText && isStatusText(labelText)) {
                var status = cleanStatusText(labelText);
                console.log('[ZFC] Status encontrado via input:', status);
                return status;
            }
        }

        // =====================================================
        // 2. BUSCAR ELEMENTOS COM ARIA-CHECKED/ARIA-SELECTED
        // =====================================================
        var ariaChecked = popup.querySelectorAll('[aria-checked="true"], [aria-selected="true"]');
        console.log('[ZFC] Elementos aria-checked:', ariaChecked.length);
        
        for (var j = 0; j < ariaChecked.length; j++) {
            var el = ariaChecked[j];
            var elText = (el.textContent || '').trim();
            console.log('[ZFC] Aria-checked', j, '- Texto:', elText);
            
            if (elText && isStatusText(elText)) {
                var status = cleanStatusText(elText);
                console.log('[ZFC] Status encontrado via aria:', status);
                return status;
            }
        }

        // =====================================================
        // 3. BUSCAR ELEMENTOS COM CLASSE SELECTED/ACTIVE/CHECKED
        // =====================================================
        var selectedEls = popup.querySelectorAll('.selected, .active, .checked, .current, [class*="selected"], [class*="active"], [class*="checked"]');
        console.log('[ZFC] Elementos com classe selected/active:', selectedEls.length);
        
        for (var k = 0; k < selectedEls.length; k++) {
            var selEl = selectedEls[k];
            // Ignorar o proprio painel do collector
            if (selEl.closest('#zfc-panel')) continue;
            
            var selText = (selEl.textContent || '').trim();
            // Pegar somente textos curtos (provavelmente labels de status)
            if (selText.length > 0 && selText.length < 60 && isStatusText(selText)) {
                var status = cleanStatusText(selText);
                console.log('[ZFC] Status encontrado via classe:', status);
                return status;
            }
        }

        // =====================================================
        // 4. BUSCAR EM BOTOES/CHIPS/BADGES DESTACADOS
        // =====================================================
        var badges = popup.querySelectorAll('[class*="badge"], [class*="chip"], [class*="tag"], [class*="status"], button.active, button.selected');
        console.log('[ZFC] Badges/chips encontrados:', badges.length);
        
        for (var m = 0; m < badges.length; m++) {
            var badge = badges[m];
            var badgeText = (badge.textContent || '').trim();
            
            if (badgeText && badgeText.length < 60 && isStatusText(badgeText)) {
                var status = cleanStatusText(badgeText);
                console.log('[ZFC] Status encontrado via badge:', status);
                return status;
            }
        }

        // =====================================================
        // 5. FALLBACK: LER TEXTO APOS "STATUS:"
        // =====================================================
        var text = popup.textContent || popup.innerText || '';
        var statusMatch = text.match(/Status[:\s]+([^\n]+?)(?=\s*Procedimento|\s*Repetido|\s*\d{2}\/|$)/i);
        
        if (statusMatch) {
            var rawStatus = statusMatch[1].trim();
            var status = cleanStatusText(rawStatus);
            console.log('[ZFC] Status encontrado via texto:', status, '(raw:', rawStatus, ')');
            return status;
        }

        console.log('[ZFC] Nenhum status encontrado');
        return '';
    }

    /**
     * Obtem o texto do label associado a um input
     */
    function getLabelForInput(input, popup) {
        // 1. Label via atributo "for"
        if (input.id) {
            var labelFor = popup.querySelector('label[for="' + input.id + '"]');
            if (labelFor) {
                return (labelFor.textContent || '').trim();
            }
        }

        // 2. Input dentro de um label
        var parent = input.parentElement;
        while (parent && parent !== popup) {
            if (parent.tagName === 'LABEL') {
                // Pegar texto do label, excluindo o input
                var clone = parent.cloneNode(true);
                var inputs = clone.querySelectorAll('input');
                for (var i = 0; i < inputs.length; i++) {
                    inputs[i].remove();
                }
                return (clone.textContent || '').trim();
            }
            parent = parent.parentElement;
        }

        // 3. Elemento irmao (span, div) ao lado
        var sibling = input.nextElementSibling;
        if (sibling) {
            var sibText = (sibling.textContent || '').trim();
            if (sibText.length < 60) return sibText;
        }

        // 4. Texto no container pai
        var parentEl = input.parentElement;
        if (parentEl) {
            var parentText = '';
            var children = parentEl.childNodes;
            for (var j = 0; j < children.length; j++) {
                var child = children[j];
                if (child.nodeType === Node.TEXT_NODE) {
                    parentText += child.textContent;
                }
            }
            parentText = parentText.trim();
            if (parentText.length > 0 && parentText.length < 60) return parentText;
        }

        // 5. Atributos do input
        return input.getAttribute('aria-label') || 
               input.getAttribute('title') || 
               input.getAttribute('value') || '';
    }

    /**
     * Verifica se o texto parece ser um status valido
     */
    function isStatusText(text) {
        if (!text) return false;
        var lower = text.toLowerCase().trim();
        
        // Lista de termos que indicam status
        var statusKeywords = [
            'atendido', 'faltou', 'cancelad', 'agendad', 'confirmad',
            'presenca', 'presença', 'nao atendido', 'não atendido',
            'aguardando', 'pendente', 'em atendimento'
        ];
        
        for (var i = 0; i < statusKeywords.length; i++) {
            if (lower.indexOf(statusKeywords[i]) >= 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Limpa e normaliza o texto do status
     * IMPORTANTE: Extrai APENAS o primeiro status valido, ignorando lixo concatenado
     */
    function cleanStatusText(text) {
        if (!text) return '';
        
        var lower = text.toLowerCase().trim();
        
        // Lista de status possiveis - em ordem de prioridade
        var statusList = [
            { pattern: /presen[cç]a\s*confirmada/i, output: 'Presenca confirmada' },
            { pattern: /n[aã]o\s*atendido/i, output: 'Nao atendido' },
            { pattern: /em\s*atendimento/i, output: 'Em atendimento' },
            { pattern: /pre[\-\s]?cadastro/i, output: 'Pre-cadastro' },
            { pattern: /atendido/i, output: 'Atendido' },
            { pattern: /cancelado/i, output: 'Cancelado' },
            { pattern: /faltou/i, output: 'Faltou' },
            { pattern: /agendado/i, output: 'Agendado' },
            { pattern: /remarcar/i, output: 'Remarcar' },
            { pattern: /aten[cç][aã]o/i, output: 'Atencao' },
            { pattern: /aguardando/i, output: 'Aguardando' },
            { pattern: /pendente/i, output: 'Pendente' }
        ];
        
        // Encontrar o PRIMEIRO status que aparece no texto
        // Usamos a posicao no texto para determinar qual e o selecionado
        var firstMatch = null;
        var firstPos = -1;
        
        for (var i = 0; i < statusList.length; i++) {
            var match = lower.match(statusList[i].pattern);
            if (match) {
                var pos = lower.indexOf(match[0]);
                if (firstPos === -1 || pos < firstPos) {
                    firstPos = pos;
                    firstMatch = statusList[i].output;
                }
            }
        }
        
        if (firstMatch) {
            console.log('[ZFC] Status extraido:', firstMatch, '(de:', text.substring(0, 50), '...)');
            return firstMatch;
        }
        
        // Se nao encontrou nenhum conhecido, pegar a primeira palavra
        var firstWord = text.trim().split(/\s+/)[0];
        if (firstWord && firstWord.length < 30) {
            return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
        }
        
        return '';
    }

    function cleanData(data) {
        for (var key in data) {
            if (typeof data[key] === 'string') {
                // Remover espacos extras
                data[key] = data[key].replace(/\s+/g, ' ').trim();
                // Remover caracteres de fechar (x)
                data[key] = data[key].replace(/[×✕✖]$/g, '').trim();
                // Remover campos vazados
                data[key] = data[key].replace(/\s*(Paciente|Fisioterapeuta|Celular|Conv[êe]nio|Status|Procedimento|Repetido):.*/i, '').trim();
            }
        }
    }

    function formatData(data) {
        var output = '';
        if (data.horario) output += 'Horario: ' + data.horario + '\n';
        if (data.fisioterapeuta) output += 'Fisioterapeuta: ' + data.fisioterapeuta + '\n';
        if (data.paciente) output += 'Paciente: ' + data.paciente + '\n';
        if (data.celular) output += 'Celular: ' + data.celular + '\n';
        if (data.convenio) output += 'Convenio: ' + data.convenio + '\n';
        if (data.status) output += 'Status: ' + data.status + '\n';
        if (data.procedimentos) output += 'Procedimentos: ' + data.procedimentos + '\n';
        if (data.valor) output += 'Valor: ' + data.valor + '\n';
        return output.trim();
    }

    function padNumber(value) {
        return value < 10 ? '0' + value : String(value);
    }

    function buildExportFileName(date) {
        var sourceDate = date || new Date();
        return 'zenfisio-dados-' +
            sourceDate.getFullYear() + '-' +
            padNumber(sourceDate.getMonth() + 1) + '-' +
            padNumber(sourceDate.getDate()) +
            '.txt';
    }

    function buildExportContent() {
        var content = '============================================================\n';
        content += 'ZENFISIO COLLECTOR - DADOS COLETADOS\n';
        content += 'Data: ' + new Date().toLocaleString('pt-BR') + '\n';
        content += 'Total: ' + state.collectedData.length + ' agendamentos\n';
        content += '============================================================\n\n';

        for (var i = 0; i < state.collectedData.length; i++) {
            var item = state.collectedData[i];
            content += '--- Agendamento ' + (i + 1) + ' ---\n';
            content += 'Coletado em: ' + new Date(item.timestamp).toLocaleString('pt-BR') + '\n\n';
            content += item.formatted + '\n\n';
            content += '------------------------------------------------------------\n\n';
        }

        return content;
    }

    function canUseNativeSavePicker() {
        return typeof window.showSaveFilePicker === 'function';
    }

    async function saveContentWithNativePicker(content, fileName) {
        var fileHandle = await window.showSaveFilePicker({
            startIn: 'downloads',
            suggestedName: fileName,
            types: [
                {
                    description: 'Arquivo de texto',
                    accept: { 'text/plain': ['.txt'] }
                }
            ]
        });

        var writable = await fileHandle.createWritable();
        try {
            await writable.write(content);
        } finally {
            await writable.close();
        }
    }

    function saveContentWithFallbackDownload(content, fileName) {
        var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(function() {
            URL.revokeObjectURL(url);
        }, 0);
    }

    // ========================================
    // ACOES
    // ========================================
    async function saveToFile() {
        if (state.collectedData.length === 0) {
            showNotification('Nenhum dado para salvar!', 'error');
            return;
        }

        var content = buildExportContent();
        var fileName = buildExportFileName();

        try {
            if (canUseNativeSavePicker()) {
                await saveContentWithNativePicker(content, fileName);
            } else {
                saveContentWithFallbackDownload(content, fileName);
            }

            showNotification('Arquivo salvo!', 'success');
        } catch (error) {
            if (error && error.name === 'AbortError') {
                showNotification('Exportacao cancelada!', 'info');
                return;
            }

            console.error('[ZFC] Erro ao salvar arquivo:', error);
            showNotification('Erro ao salvar arquivo!', 'error');
        }
    }

    function copyToClipboard() {
        if (state.collectedData.length === 0) {
            showNotification('Nenhum dado para copiar!', 'error');
            return;
        }

        var content = '';
        for (var i = 0; i < state.collectedData.length; i++) {
            content += state.collectedData[i].formatted;
            if (i < state.collectedData.length - 1) content += '\n\n---\n\n';
        }
        
        navigator.clipboard.writeText(content).then(function() {
            showNotification('Dados copiados!', 'success');
        }).catch(function() {
            showNotification('Erro ao copiar!', 'error');
        });
    }

    function clearData() {
        if (state.collectedData.length === 0) {
            showNotification('Nao ha dados!', 'info');
            return;
        }

        if (confirm('Limpar todos os dados coletados?')) {
            state.collectedData = [];
            state.lastCollectedId = null;
            updateCountUI();
            updatePreviewUI('Nenhum dado coletado ainda...');
            saveToStorage();
            showNotification('Dados limpos!', 'success');
        }
    }

    // ========================================
    // UI UPDATES
    // ========================================
    function updateStatusUI(isActive) {
        var statusEl = document.getElementById('zfc-status');
        var statusText = statusEl.querySelector('.zfc-status-text');
        var startBtn = document.getElementById('zfc-start');
        var stopBtn = document.getElementById('zfc-stop');
        var header = document.getElementById('zfc-header');

        if (isActive) {
            statusEl.classList.add('active');
            statusText.textContent = 'Monitorando...';
            startBtn.disabled = true;
            stopBtn.disabled = false;
            // Usar setProperty para forcar !important e garantir que mude para verde
            if (header) header.style.setProperty('background', 'linear-gradient(135deg, #10b981, #059669)', 'important');
        } else {
            statusEl.classList.remove('active');
            statusText.textContent = 'Parado';
            startBtn.disabled = false;
            stopBtn.disabled = true;
            // Usar setProperty para forcar !important e garantir que fique vermelho
            if (header) header.style.setProperty('background', 'linear-gradient(135deg, #ef4444, #dc2626)', 'important');
        }
    }

    function updateCountUI() {
        var countEl = document.getElementById('zfc-count');
        if (countEl) countEl.textContent = state.collectedData.length;
    }

    function updatePreviewUI(text) {
        var previewEl = document.getElementById('zfc-preview-content');
        if (previewEl) previewEl.textContent = text;
    }

    function showNotification(message, type) {
        type = type || 'info';
        var notification = document.createElement('div');
        notification.className = 'zfc-notification zfc-notification-' + type;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(function() { notification.classList.add('show'); }, 10);
        setTimeout(function() {
            notification.classList.remove('show');
            setTimeout(function() { notification.remove(); }, 300);
        }, 2500);
    }

    // ========================================
    // PERSISTENCIA
    // ========================================
    function saveToStorage() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.set({ zenfisio_collector_data: state.collectedData });
            } else {
                localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.collectedData));
            }
        } catch (e) {
            console.error('[ZFC] Erro ao salvar:', e);
        }
    }

    function loadSavedData() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['zenfisio_collector_data'], function(result) {
                    if (result.zenfisio_collector_data) {
                        state.collectedData = result.zenfisio_collector_data;
                        updateCountUI();
                        if (state.collectedData.length > 0) {
                            updatePreviewUI(state.collectedData[state.collectedData.length - 1].formatted);
                        }
                    }
                });
            } else {
                var saved = localStorage.getItem(CONFIG.storageKey);
                if (saved) {
                    state.collectedData = JSON.parse(saved);
                }
            }
        } catch (e) {
            console.error('[ZFC] Erro ao carregar:', e);
        }
    }

    // ========================================
    // INICIAR
    // ========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
