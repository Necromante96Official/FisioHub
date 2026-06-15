/**
 * ZENFISIO COLETOR DE DADOS v0.5.5
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
        version: '0.5.5',
        storageKey: 'zenfisio_collector_data',
        activeStorageKey: 'zenfisio_collector_active',
        popupCheckDelay: 500,
        autoClickDelay: 900,
        autoCollectTimeout: 3200,
        duplicateBlockTime: 5000,  // Tempo para bloquear duplicatas (5 segundos)
        maxRecentIds: 50          // Máximo de IDs recentes a guardar
    };

    function createElement(tagName, options) {
        options = options || {};
        var element = document.createElement(tagName);
        if (options.id) element.id = options.id;
        if (options.className) element.className = options.className;
        if (options.textContent !== undefined) element.textContent = options.textContent;
        if (options.type) element.type = options.type;
        if (options.title) element.title = options.title;
        if (options.disabled !== undefined) element.disabled = options.disabled;
        return element;
    }

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
        isCollecting: false,       // Flag para evitar coletas simultâneas
        isAutoCollecting: false,
        autoStopRequested: false,
        autoTotal: 0,
        autoCurrent: 0,
        collectionSequence: 0,
        isDragging: false,
        suppressNextToggle: false
    };

    // ========================================
    // INICIALIZACAO
    // ========================================
    function init() {
        console.log('[ZFC] zenfisio-ColetorDeDados v' + CONFIG.version + ' carregado!');
        console.log('[ZFC] Pressione Ctrl+Shift+X para ativar/desativar');

        // Configurar atalho de teclado
        setupKeyboardShortcut();

        loadActiveState(function() {
            if (state.isActive) {
                loadSavedData();
                createUI();
                showActivationNotification(true);
            }
        });

        setupRuntimeMessages();
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

    function setupRuntimeMessages() {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;

        chrome.runtime.onMessage.addListener(function(message) {
            if (!message || message.type !== 'ZFC_TOGGLE_COLLECTOR') return;
            toggleCollector();
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
            console.log('[ZFC] ✅ Coletor ATIVADO');
        } else {
            // Desativar
            if (state.isMonitoring) {
                stopMonitoring();
            }
            removeUI();
            showActivationNotification(false);
            console.log('[ZFC] ❌ Coletor DESATIVADO');
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
        var row = createElement('div');
        row.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        var icon = createElement('span', { textContent: isActivating ? '✅' : '❌' });
        icon.style.fontSize = '28px';
        var copy = createElement('div');
        var name = createElement('div', { textContent: 'zenfisio-ColetorDeDados' });
        name.style.cssText = 'font-size: 14px; opacity: 0.8;';
        var stateLabel = createElement('div', { textContent: isActivating ? 'ATIVADO' : 'DESATIVADO' });
        copy.appendChild(name);
        copy.appendChild(stateLabel);
        row.appendChild(icon);
        row.appendChild(copy);
        var shortcut = createElement('div', { textContent: 'Ctrl+Shift+X para alternar' });
        shortcut.style.cssText = 'font-size: 11px; margin-top: 10px; opacity: 0.7;';
        notif.appendChild(row);
        notif.appendChild(shortcut);
        
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
     * Salva o estado ativo no chrome.storage.local
     */
    function saveActiveState() {
        try {
            var payload = {};
            payload[CONFIG.activeStorageKey] = state.isActive;
            chrome.storage.local.set(payload);
        } catch (e) {
            console.error('[ZFC] Erro ao salvar estado:', e);
        }
    }

    /**
     * Carrega o estado ativo do chrome.storage.local
     */
    function loadActiveState(callback) {
        try {
            chrome.storage.local.get([CONFIG.activeStorageKey], function(result) {
                state.isActive = result[CONFIG.activeStorageKey] === true;
                if (callback) callback();
            });
        } catch (e) {
            state.isActive = false;
            if (callback) callback();
        }
    }

    // ========================================
    // INTERFACE DO USUARIO - UNICO PAINEL
    // ========================================
    function createUI() {
        // Remover elementos existentes se houver
        var existingPanel = document.getElementById('zfc-panel');
        if (existingPanel) existingPanel.remove();

        var container = document.createElement('div');
        container.id = 'zfc-panel';
        container.className = 'minimized';
        state.isMinimized = true;

        var accent = createElement('div', { className: 'zfc-accent' });
        var header = createElement('div', { id: 'zfc-header', className: 'zfc-header' });
        var brand = createElement('div', { className: 'zfc-brand' });
        var title = createElement('div', { className: 'zfc-title' });
        title.appendChild(createElement('span', { className: 'zfc-logo', textContent: 'ZF' }));
        var titleCopy = createElement('span', { className: 'zfc-title-copy' });
        titleCopy.appendChild(createElement('span', { className: 'zfc-kicker', textContent: 'Zenfisio' }));
        titleCopy.appendChild(createElement('span', { className: 'zfc-name', textContent: 'Coletor de Dados' }));
        title.appendChild(titleCopy);
        brand.appendChild(title);
        brand.appendChild(createElement('div', { className: 'zfc-subtitle', textContent: 'Coleta premium de agendamentos' }));
        var headerActions = createElement('div', { className: 'zfc-header-actions' });
        headerActions.appendChild(createElement('span', { className: 'zfc-version', textContent: 'v' + CONFIG.version }));
        var minimizeButton = createElement('button', { id: 'zfc-minimize', className: 'zfc-btn-minimize', type: 'button', title: 'Minimizar', textContent: '_' });
        headerActions.appendChild(minimizeButton);
        header.appendChild(brand);
        header.appendChild(headerActions);

        var miniSummary = createElement('div', { className: 'zfc-mini-summary' });
        miniSummary.appendChild(createElement('div', { className: 'zfc-mini-shortcut', textContent: 'Atalho: Ctrl + Shift + X abre/ativa/desativa' }));
        var miniHeader = createElement('div', { className: 'zfc-mini-header' });
        var miniTitle = createElement('div', { className: 'zfc-mini-title' });
        miniTitle.appendChild(createElement('span', { className: 'zfc-mini-logo', textContent: 'ZF' }));
        miniTitle.appendChild(createElement('span', { textContent: 'Coletor' }));
        miniHeader.appendChild(miniTitle);

        var miniCountBox = createElement('div', { className: 'zfc-mini-count-box' });
        miniCountBox.appendChild(createElement('span', { className: 'zfc-mini-label', textContent: 'Coletas salvas' }));
        miniCountBox.appendChild(createElement('span', { id: 'zfc-mini-count', className: 'zfc-mini-count', textContent: '0' }));

        var miniActions = createElement('div', { className: 'zfc-mini-actions' });
        miniActions.appendChild(createElement('button', { id: 'zfc-mini-save', className: 'zfc-mini-action zfc-mini-action-save', type: 'button', textContent: 'Salvar TXT', disabled: true }));
        miniActions.appendChild(createElement('button', { id: 'zfc-mini-clear', className: 'zfc-mini-action zfc-mini-action-clear', type: 'button', textContent: 'Limpar dados', disabled: true }));
        miniActions.appendChild(createElement('button', { id: 'zfc-mini-monitor', className: 'zfc-mini-action zfc-mini-action-monitor', type: 'button', textContent: 'Iniciar' }));
        miniActions.appendChild(createElement('button', { id: 'zfc-mini-auto', className: 'zfc-mini-action zfc-mini-action-auto', type: 'button', textContent: 'Coletar auto' }));

        miniSummary.appendChild(miniHeader);
        miniSummary.appendChild(miniCountBox);
        miniSummary.appendChild(miniActions);

        var body = createElement('div', { id: 'zfc-body', className: 'zfc-body' });
        var statusBar = createElement('div', { className: 'zfc-status-bar' });
        var status = createElement('div', { id: 'zfc-status', className: 'zfc-status' });
        status.appendChild(createElement('span', { className: 'zfc-dot' }));
        var statusCopy = createElement('span', { className: 'zfc-status-copy' });
        statusCopy.appendChild(createElement('span', { className: 'zfc-status-label', textContent: 'Status' }));
        statusCopy.appendChild(createElement('span', { className: 'zfc-status-text', textContent: 'Parado' }));
        status.appendChild(statusCopy);
        statusBar.appendChild(status);
        var countBox = createElement('div', { className: 'zfc-count-box' });
        countBox.appendChild(createElement('span', { className: 'zfc-count-label', textContent: 'Coletas' }));
        countBox.appendChild(createElement('span', { id: 'zfc-count', className: 'zfc-count', textContent: '0' }));
        statusBar.appendChild(countBox);

        var monitorSection = createElement('div', { className: 'zfc-section' });
        monitorSection.appendChild(createElement('div', { className: 'zfc-section-title', textContent: 'Monitoramento' }));
        var monitorActions = createElement('div', { className: 'zfc-actions' });
        monitorActions.appendChild(createElement('button', { id: 'zfc-start', className: 'zfc-btn zfc-btn-start', type: 'button', textContent: 'Iniciar' }));
        monitorActions.appendChild(createElement('button', { id: 'zfc-stop', className: 'zfc-btn zfc-btn-stop', type: 'button', textContent: 'Parar', disabled: true }));
        monitorSection.appendChild(monitorActions);

        var autoSection = createElement('div', { className: 'zfc-section zfc-auto-section' });
        autoSection.appendChild(createElement('div', { className: 'zfc-section-title', textContent: 'Automacao' }));
        var autoActions = createElement('div', { className: 'zfc-actions' });
        autoActions.appendChild(createElement('button', { id: 'zfc-auto-start', className: 'zfc-btn zfc-btn-auto', type: 'button', textContent: 'Coletar visiveis' }));
        autoActions.appendChild(createElement('button', { id: 'zfc-auto-stop', className: 'zfc-btn zfc-btn-auto-stop', type: 'button', textContent: 'Parar auto', disabled: true }));
        autoSection.appendChild(autoActions);
        autoSection.appendChild(createElement('div', { id: 'zfc-auto-progress', className: 'zfc-auto-progress', textContent: 'Pronto para coletar eventos visiveis entre 08h e 17h.' }));

        var exportSection = createElement('div', { className: 'zfc-section' });
        exportSection.appendChild(createElement('div', { className: 'zfc-section-title', textContent: 'Exportacao' }));
        var exportActions = createElement('div', { className: 'zfc-actions' });
        exportActions.appendChild(createElement('button', { id: 'zfc-save', className: 'zfc-btn zfc-btn-save', type: 'button', textContent: 'Salvar TXT' }));
        exportActions.appendChild(createElement('button', { id: 'zfc-copy', className: 'zfc-btn zfc-btn-copy', type: 'button', textContent: 'Copiar' }));
        exportSection.appendChild(exportActions);

        var maintenanceSection = createElement('div', { className: 'zfc-section zfc-section-compact' });
        maintenanceSection.appendChild(createElement('div', { className: 'zfc-section-title', textContent: 'Manutencao' }));
        maintenanceSection.appendChild(createElement('button', { id: 'zfc-clear', className: 'zfc-btn zfc-btn-clear', type: 'button', textContent: 'Limpar Dados' }));

        var shortcutHint = createElement('div', { className: 'zfc-shortcut-hint', textContent: 'Atalho: Ctrl + Shift + X para ativar/desativar' });

        var preview = createElement('div', { className: 'zfc-preview' });
        preview.appendChild(createElement('div', { className: 'zfc-preview-title', textContent: 'Ultimo coletado:' }));
        preview.appendChild(createElement('div', { id: 'zfc-preview-content', className: 'zfc-preview-content', textContent: 'Nenhum dado coletado ainda...' }));

        body.appendChild(statusBar);
        body.appendChild(monitorSection);
        body.appendChild(autoSection);
        body.appendChild(exportSection);
        body.appendChild(maintenanceSection);
        body.appendChild(shortcutHint);
        body.appendChild(preview);

        container.appendChild(accent);
        container.appendChild(header);
        container.appendChild(miniSummary);
        container.appendChild(body);
        document.body.appendChild(container);

        // Adicionar eventos
        attachEventListeners();

        // Atualizar status inicial
        updateStatusUI(state.isMonitoring);

        // Atualizar contador
        updateCountUI();

        // Atualizar estado inicial da automacao
        updateAutoCollectUI();
    }

    function attachEventListeners() {
        // Botoes
        document.getElementById('zfc-start').onclick = startMonitoring;
        document.getElementById('zfc-stop').onclick = stopMonitoring;
        document.getElementById('zfc-auto-start').onclick = startAutoCollectVisibleAppointments;
        document.getElementById('zfc-auto-stop').onclick = requestStopAutoCollect;
        document.getElementById('zfc-save').onclick = saveToFile;
        document.getElementById('zfc-mini-save').onclick = saveToFile;
        document.getElementById('zfc-mini-clear').onclick = clearData;
        document.getElementById('zfc-mini-monitor').onclick = toggleMonitoringFromMini;
        document.getElementById('zfc-mini-auto').onclick = startAutoCollectVisibleAppointments;
        document.getElementById('zfc-copy').onclick = copyToClipboard;
        document.getElementById('zfc-clear').onclick = clearData;
        // Arrastar painel
        makeDraggable();
    }

    function makeDraggable() {
        var panel = document.getElementById('zfc-panel');
        var header = document.getElementById('zfc-header');
        var miniHeader = panel.querySelector('.zfc-mini-header');
        var pointerId = null;
        var hasMoved = false;
        var startX = 0;
        var startY = 0;
        var offsetX = 0;
        var offsetY = 0;
        var activeHandle = null;

        function movePanel(clientX, clientY) {
            var rect = panel.getBoundingClientRect();
            var x = clientX - offsetX;
            var y = clientY - offsetY;
            x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
            y = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
            panel.style.left = x + 'px';
            panel.style.top = y + 'px';
            panel.style.right = 'auto';
        }

        function stopDragging(e) {
            if (!state.isDragging || (pointerId !== null && e.pointerId !== pointerId)) return;

            state.isDragging = false;
            pointerId = null;
            panel.classList.remove('is-dragging');
            if (activeHandle) activeHandle.style.cursor = 'grab';
            activeHandle = null;

            if (hasMoved) {
                state.suppressNextToggle = true;
                setTimeout(function() {
                    state.suppressNextToggle = false;
                }, 180);
            }
        }

        function startDragging(e) {
            if (e.button !== undefined && e.button !== 0) return;
            if (e.target.closest && e.target.closest('button')) return;

            var rect = panel.getBoundingClientRect();
            activeHandle = e.currentTarget;
            pointerId = e.pointerId;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            panel.style.left = rect.left + 'px';
            panel.style.top = rect.top + 'px';
            panel.style.right = 'auto';
            state.isDragging = true;
            panel.classList.add('is-dragging');
            activeHandle.style.cursor = 'grabbing';
            activeHandle.setPointerCapture(e.pointerId);
            e.preventDefault();
        }

        function moveDragging(e) {
            if (!state.isDragging || e.pointerId !== pointerId) return;

            var deltaX = Math.abs(e.clientX - startX);
            var deltaY = Math.abs(e.clientY - startY);
            if (!hasMoved && deltaX + deltaY < 4) return;

            hasMoved = true;
            movePanel(e.clientX, e.clientY);
            e.preventDefault();
        }

        header.onpointerdown = startDragging;
        header.onpointermove = moveDragging;
        header.onpointerup = stopDragging;
        header.onpointercancel = stopDragging;

        miniHeader.onpointerdown = startDragging;
        miniHeader.onpointermove = moveDragging;
        miniHeader.onpointerup = stopDragging;
        miniHeader.onpointercancel = stopDragging;

        window.addEventListener('resize', function() {
            if (!document.body.contains(panel)) return;
            keepPanelInsideViewport();
        });
    }

    function keepPanelInsideViewport() {
        var panel = document.getElementById('zfc-panel');
        if (!panel) return;

        var rect = panel.getBoundingClientRect();
        var x = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8));
        var y = Math.max(8, Math.min(rect.top, window.innerHeight - rect.height - 8));
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.style.right = 'auto';
    }

    function toggleMinimize() {
        var panel = document.getElementById('zfc-panel');
        var btn = document.getElementById('zfc-minimize');
        if (state.isDragging || state.suppressNextToggle) return;

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

        requestAnimationFrame(keepPanelInsideViewport);
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
        requestStopAutoCollect();
        
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

    function toggleMonitoringFromMini() {
        if (state.isMonitoring) {
            stopMonitoring();
        } else {
            startMonitoring();
        }
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
    // COLETA AUTOMATICA POR CLIQUE CONTROLADO
    // ========================================
    function requestStopAutoCollect() {
        if (!state.isAutoCollecting) return;
        state.autoStopRequested = true;
        updateAutoCollectUI('Parando apos o agendamento atual...');
    }

    function delay(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    }

    function isElementVisible(element) {
        if (!element || element.closest('#zfc-panel')) return false;
        var rect = element.getBoundingClientRect();
        var style = window.getComputedStyle(element);
        return rect.width >= 24 &&
            rect.height >= 12 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0';
    }

    function getAppointmentStartMinutes(text) {
        var match = (text || '').match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
        if (!match) return null;

        return (parseInt(match[1], 10) * 60) + parseInt(match[2], 10);
    }

    function isInsideCollectableHours(text) {
        var startMinutes = getAppointmentStartMinutes(text);
        if (startMinutes === null) return false;

        // Coleta automatica apenas dos blocos entre 08:00 e 17:59.
        return startMinutes >= (8 * 60) && startMinutes < (18 * 60);
    }

    function looksLikeAppointmentBlock(element) {
        var text = (element.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length < 6) return false;
        if (!isInsideCollectableHours(text)) return false;

        var rect = element.getBoundingClientRect();
        if (rect.width < 35 || rect.height < 14) return false;

        return true;
    }

    function getVisibleAppointmentBlocks() {
        var selectors = [
            '.fc-event',
            '.fc-time-grid-event',
            '.fc-v-event',
            '.fc-h-event'
        ];
        var nodes = [];

        for (var i = 0; i < selectors.length; i++) {
            var found = document.querySelectorAll(selectors[i]);
            for (var j = 0; j < found.length; j++) {
                var element = found[j];
                if (nodes.indexOf(element) === -1 && isElementVisible(element) && looksLikeAppointmentBlock(element)) {
                    nodes.push(element);
                }
            }
        }

        nodes.sort(function(a, b) {
            var rectA = a.getBoundingClientRect();
            var rectB = b.getBoundingClientRect();
            if (Math.abs(rectA.top - rectB.top) > 8) return rectA.top - rectB.top;
            return rectA.left - rectB.left;
        });

        return nodes;
    }

    function clickAppointmentBlock(element) {
        var rect = element.getBoundingClientRect();
        var x = rect.left + Math.min(rect.width / 2, Math.max(8, rect.width - 8));
        var y = rect.top + Math.min(rect.height / 2, Math.max(8, rect.height - 8));
        var options = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0
        };

        element.dispatchEvent(new MouseEvent('mouseover', options));
        element.dispatchEvent(new MouseEvent('mousedown', options));
        element.dispatchEvent(new MouseEvent('mouseup', options));
        element.dispatchEvent(new MouseEvent('click', options));
    }

    function closeAppointmentPopup() {
        var closeSelectors = [
            '[aria-label*="Fechar"]',
            '[aria-label*="fechar"]',
            '[aria-label*="Close"]',
            '[aria-label*="close"]',
            '.close',
            '.modal-close',
            'button.close'
        ];

        for (var i = 0; i < closeSelectors.length; i++) {
            var button = document.querySelector(closeSelectors[i]);
            if (button && !button.closest('#zfc-panel')) {
                button.click();
                return;
            }
        }

        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            keyCode: 27,
            which: 27,
            bubbles: true
        }));
    }

    async function waitForCollectionOrTimeout(previousSequence) {
        var start = Date.now();
        while (Date.now() - start < CONFIG.autoCollectTimeout) {
            if (state.collectionSequence > previousSequence) return true;
            if (state.autoStopRequested) return false;
            await delay(120);
        }
        return false;
    }

    async function startAutoCollectVisibleAppointments() {
        if (state.isAutoCollecting) return;

        if (!state.isMonitoring) {
            startMonitoring();
        }

        var blocks = getVisibleAppointmentBlocks();
        if (blocks.length === 0) {
            showNotification('Nenhum agendamento visivel entre 08h e 17h.', 'info');
            updateAutoCollectUI('Nenhum agendamento visivel entre 08h e 17h.');
            return;
        }

        var shouldCollect = await showSystemConfirm({
            title: 'Coleta automatica',
            message: 'Coletar automaticamente os ' + blocks.length + ' agendamentos visiveis entre 08h e 17h?',
            confirmText: 'Coletar',
            cancelText: 'Cancelar',
            tone: 'info'
        });
        if (!shouldCollect) {
            return;
        }

        state.isAutoCollecting = true;
        state.autoStopRequested = false;
        state.autoTotal = blocks.length;
        state.autoCurrent = 0;
        updateAutoCollectUI('Iniciando coleta automatica...');

        for (var i = 0; i < blocks.length; i++) {
            if (state.autoStopRequested) break;

            var block = blocks[i];
            if (!document.body.contains(block) || !isElementVisible(block)) {
                continue;
            }

            state.autoCurrent = i + 1;
            updateAutoCollectUI('Coletando ' + state.autoCurrent + ' de ' + state.autoTotal + '...');

            var previousSequence = state.collectionSequence;
            block.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            await delay(250);
            clickAppointmentBlock(block);
            await waitForCollectionOrTimeout(previousSequence);
            closeAppointmentPopup();
            await delay(CONFIG.autoClickDelay);
        }

        var stopped = state.autoStopRequested;
        state.isAutoCollecting = false;
        state.autoStopRequested = false;
        updateAutoCollectUI(stopped ? 'Coleta automatica interrompida.' : 'Coleta automatica concluida.');
        showNotification(stopped ? 'Coleta automatica interrompida.' : 'Coleta automatica concluida!', stopped ? 'info' : 'success');
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
            state.collectionSequence += 1;

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

    function parsePortugueseCalendarDate(text) {
        if (!text) return null;

        var normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
        var months = {
            janeiro: 0,
            fevereiro: 1,
            marco: 2,
            março: 2,
            abril: 3,
            maio: 4,
            junho: 5,
            julho: 6,
            agosto: 7,
            setembro: 8,
            outubro: 9,
            novembro: 10,
            dezembro: 11
        };

        var match = normalized.match(/\b(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})\b/i);
        if (!match || months[match[2]] === undefined) return null;

        return new Date(parseInt(match[3], 10), months[match[2]], parseInt(match[1], 10));
    }

    function findVisibleCalendarDate() {
        var candidates = document.querySelectorAll('h1, h2, h3, h4, .fc-center, .fc-toolbar-title, .fc-header-title, [class*="title"], [class*="date"]');

        for (var i = 0; i < candidates.length; i++) {
            var element = candidates[i];
            if (!isElementVisible(element) || element.closest('#zfc-panel')) continue;

            var parsed = parsePortugueseCalendarDate(element.textContent || '');
            if (parsed) return parsed;
        }

        var bodyMatch = (document.body.textContent || '').match(/\b\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4}\b/i);
        return bodyMatch ? parsePortugueseCalendarDate(bodyMatch[0]) : null;
    }

    function formatExportDateToken(date) {
        var sourceDate = date || new Date();
        return padNumber(sourceDate.getDate()) + '.' +
            padNumber(sourceDate.getMonth() + 1) + '.' +
            String(sourceDate.getFullYear()).slice(-2);
    }

    function buildExportFileName(date) {
        return formatExportDateToken(date || findVisibleCalendarDate() || new Date()) + '.txt';
    }

    function buildExportContent() {
        var content = '============================================================\n';
        content += 'ZENFISIO COLETOR DE DADOS\n';
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

    async function clearData() {
        if (state.collectedData.length === 0) {
            showNotification('Nao ha dados!', 'info');
            return;
        }

        var shouldClear = await showSystemConfirm({
            title: 'Limpar dados',
            message: 'Remover todas as coletas salvas no momento?',
            confirmText: 'Limpar',
            cancelText: 'Cancelar',
            tone: 'danger'
        });
        if (!shouldClear) return;

        state.collectedData = [];
        state.lastCollectedId = null;
        updateCountUI();
        updatePreviewUI('Nenhum dado coletado ainda...');
        saveToStorage();
        showNotification('Dados limpos!', 'success');
    }

    // ========================================
    // UI UPDATES
    // ========================================
    function updateStatusUI(isActive) {
        var statusEl = document.getElementById('zfc-status');
        var statusText = statusEl.querySelector('.zfc-status-text');
        var startBtn = document.getElementById('zfc-start');
        var stopBtn = document.getElementById('zfc-stop');
        var miniMonitorBtn = document.getElementById('zfc-mini-monitor');
        var panel = document.getElementById('zfc-panel');

        if (isActive) {
            statusEl.classList.add('active');
            statusText.textContent = 'Monitorando...';
            startBtn.disabled = true;
            stopBtn.disabled = false;
            if (miniMonitorBtn) miniMonitorBtn.textContent = 'Desativar';
            if (panel) panel.setAttribute('data-monitoring', 'true');
        } else {
            statusEl.classList.remove('active');
            statusText.textContent = 'Parado';
            startBtn.disabled = false;
            stopBtn.disabled = true;
            if (miniMonitorBtn) miniMonitorBtn.textContent = 'Iniciar';
            if (panel) panel.setAttribute('data-monitoring', 'false');
        }
    }

    function updateCountUI() {
        var countEl = document.getElementById('zfc-count');
        var miniCountEl = document.getElementById('zfc-mini-count');
        var miniSaveBtn = document.getElementById('zfc-mini-save');
        var miniClearBtn = document.getElementById('zfc-mini-clear');
        if (countEl) countEl.textContent = state.collectedData.length;
        if (miniCountEl) miniCountEl.textContent = state.collectedData.length;
        if (miniSaveBtn) miniSaveBtn.disabled = state.collectedData.length === 0;
        if (miniClearBtn) miniClearBtn.disabled = state.collectedData.length === 0;
    }

    function updateAutoCollectUI(message) {
        var panel = document.getElementById('zfc-panel');
        var startBtn = document.getElementById('zfc-auto-start');
        var stopBtn = document.getElementById('zfc-auto-stop');
        var miniAutoBtn = document.getElementById('zfc-mini-auto');
        var progressEl = document.getElementById('zfc-auto-progress');

        if (panel) panel.setAttribute('data-auto-collecting', state.isAutoCollecting ? 'true' : 'false');
        if (startBtn) startBtn.disabled = state.isAutoCollecting;
        if (stopBtn) stopBtn.disabled = !state.isAutoCollecting;
        if (miniAutoBtn) {
            miniAutoBtn.disabled = state.isAutoCollecting;
            miniAutoBtn.textContent = state.isAutoCollecting ? 'Coletando...' : 'Coletar auto';
        }
        if (progressEl && message) progressEl.textContent = message;
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

    function showSystemConfirm(options) {
        options = options || {};

        return new Promise(function(resolve) {
            var existingDialog = document.getElementById('zfc-confirm-overlay');
            if (existingDialog) existingDialog.remove();

            var overlay = createElement('div', { id: 'zfc-confirm-overlay', className: 'zfc-confirm-overlay' });
            var dialog = createElement('div', { className: 'zfc-confirm-dialog zfc-confirm-dialog-' + (options.tone || 'info') });
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'zfc-confirm-title');
            dialog.setAttribute('aria-describedby', 'zfc-confirm-message');

            var icon = createElement('div', { className: 'zfc-confirm-icon', textContent: options.tone === 'danger' ? '!' : '?' });
            var content = createElement('div', { className: 'zfc-confirm-content' });
            content.appendChild(createElement('div', { id: 'zfc-confirm-title', className: 'zfc-confirm-title', textContent: options.title || 'Confirmar acao' }));
            content.appendChild(createElement('div', { id: 'zfc-confirm-message', className: 'zfc-confirm-message', textContent: options.message || 'Deseja continuar?' }));
            var shortcut = createElement('div', { className: 'zfc-confirm-shortcut', textContent: 'Enter confirma • Esc cancela' });
            content.appendChild(shortcut);

            var actions = createElement('div', { className: 'zfc-confirm-actions' });
            var cancelButton = createElement('button', { className: 'zfc-confirm-btn zfc-confirm-cancel', type: 'button', textContent: options.cancelText || 'Cancelar' });
            var confirmButton = createElement('button', { className: 'zfc-confirm-btn zfc-confirm-ok', type: 'button', textContent: options.confirmText || 'Confirmar' });
            actions.appendChild(cancelButton);
            actions.appendChild(confirmButton);

            dialog.appendChild(icon);
            dialog.appendChild(content);
            dialog.appendChild(actions);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            function close(result) {
                document.removeEventListener('keydown', handleKeydown, true);
                overlay.classList.remove('show');
                setTimeout(function() {
                    if (overlay.parentNode) overlay.remove();
                }, 160);
                resolve(result);
            }

            function handleKeydown(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    close(true);
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    close(false);
                }
            }

            cancelButton.onclick = function() { close(false); };
            confirmButton.onclick = function() { close(true); };
            overlay.onclick = function(event) {
                if (event.target === overlay) close(false);
            };

            document.addEventListener('keydown', handleKeydown, true);
            setTimeout(function() {
                overlay.classList.add('show');
                confirmButton.focus();
            }, 10);
        });
    }

    // ========================================
    // PERSISTENCIA
    // ========================================
    function saveToStorage() {
        try {
            var payload = {};
            payload[CONFIG.storageKey] = state.collectedData;
            chrome.storage.local.set(payload);
        } catch (e) {
            console.error('[ZFC] Erro ao salvar:', e);
        }
    }

    function loadSavedData() {
        try {
            chrome.storage.local.get([CONFIG.storageKey], function(result) {
                if (result[CONFIG.storageKey]) {
                    state.collectedData = result[CONFIG.storageKey];
                    updateCountUI();
                    if (state.collectedData.length > 0) {
                        updatePreviewUI(state.collectedData[state.collectedData.length - 1].formatted);
                    }
                }
            });
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
