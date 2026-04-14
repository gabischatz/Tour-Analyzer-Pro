'use strict';

window.TAP = window.TAP || {};
var TAP = window.TAP;
var state = TAP.state;
var els = TAP.els;


refreshDebugPreview();

        function bindBreakpointControls() {
            if (els.breakpointsEnabled) els.breakpointsEnabled.addEventListener('change', syncBreakpointConfigFromUi);
            if (els.breakpointsAllBtn) els.breakpointsAllBtn.addEventListener('click', function () { setAllBreakpoints(true); });
            if (els.breakpointsNoneBtn) els.breakpointsNoneBtn.addEventListener('click', function () { setAllBreakpoints(false); });
            [
                'bpFileSelected', 'bpGpxParsed', 'bpTrackSimplified', 'bpTrackAnalyzed',
                'bpOsmLoadStart', 'bpOverpassBefore', 'bpOverpassAfter', 'bpGraphBuilt',
                'bpAutoPoints', 'bpRoutePieces', 'bpManualSegment'
            ].forEach(function (key) {
                if (els[key]) els[key].addEventListener('change', syncBreakpointConfigFromUi);
            });
            if (els.breakpointContinueBtn) els.breakpointContinueBtn.addEventListener('click', function () { resolveBreakpointModal('continue'); });
            if (els.breakpointSkipBtn) els.breakpointSkipBtn.addEventListener('click', function () { resolveBreakpointModal('skip'); });
            if (els.breakpointAbortBtn) els.breakpointAbortBtn.addEventListener('click', function () { resolveBreakpointModal('abort'); });
            syncBreakpointConfigFromUi();
        }

}

        function initBreakpointCardTools() {
            addCopyButton();
            enableBreakpointCardDrag();
        }

}

        function showCopyFeedback(button, text, timeout) {
            if (!button) return;
            var originalText = button.dataset.originalText || button.textContent;
            button.dataset.originalText = originalText;
            button.textContent = text;
            button.disabled = true;
            window.setTimeout(function () {
                button.textContent = originalText;
                button.disabled = false;
            }, timeout || 1600);
        }

}

        async function copyBreakpointCode() {
            var detailsEl = document.getElementById('breakpointModalDetails');
            var button = document.getElementById('breakpointCopyBtn');
            if (!detailsEl || !button) return;
            var text = detailsEl.textContent || detailsEl.innerText || '';
            if (!text.trim()) {
                showCopyFeedback(button, 'Nichts zum Kopieren', 1800);
                return;
            }
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                } else {
                    var textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.setAttribute('readonly', 'readonly');
                    textarea.style.position = 'fixed';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                }
                showCopyFeedback(button, 'Kopiert', 1400);
            } catch (err) {
                console.error('Kopieren fehlgeschlagen:', err);
                logEvent('Kopieren fehlgeschlagen: ' + (err && err.message ? err.message : String(err)), 'error');
                showCopyFeedback(button, 'Fehler beim Kopieren', 2200);
            }
        }

}

        function addCopyButton() {
            var actions = document.querySelector('.breakpoint-actions');
            if (!actions) return;
            if (document.getElementById('breakpointCopyBtn')) return;
            var copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.id = 'breakpointCopyBtn';
            copyBtn.className = 'small-btn';
            copyBtn.textContent = 'Code kopieren';
            copyBtn.style.background = '#059669';
            copyBtn.addEventListener('click', function () {
                copyBreakpointCode();
            });
            actions.insertBefore(copyBtn, actions.firstChild);
        }

}

        function enableBreakpointCardDrag() {
            var card = document.getElementById('breakpointCard');
            var title = document.getElementById('breakpointModalTitle');
            var meta = document.getElementById('breakpointModalMeta');
            if (!card || card.dataset.dragInitialized === '1') return;
            card.dataset.dragInitialized = '1';
            var drag = {
                active: false,
                offsetX: 0,
                offsetY: 0
            };
            function startDrag(ev) {
                if (ev.button !== 0) return;
                if (ev.target.closest('button, pre')) return;
                var rect = card.getBoundingClientRect();
                drag.active = true;
                drag.offsetX = ev.clientX - rect.left;
                drag.offsetY = ev.clientY - rect.top;
                card.style.left = rect.left + 'px';
                card.style.top = rect.top + 'px';
                card.style.transform = 'none';
                card.classList.add('dragging');
                ev.preventDefault();
            }
            function onMove(ev) {
                if (!drag.active) return;
                var cardRect = card.getBoundingClientRect();
                var width = cardRect.width;
                var height = cardRect.height;
                var nextLeft = ev.clientX - drag.offsetX;
                var nextTop = ev.clientY - drag.offsetY;
                var minLeft = 8;
                var minTop = 8;
                var maxLeft = Math.max(minLeft, window.innerWidth - width - 8);
                var maxTop = Math.max(minTop, window.innerHeight - height - 8);
                if (nextLeft < minLeft) nextLeft = minLeft;
                if (nextTop < minTop) nextTop = minTop;
                if (nextLeft > maxLeft) nextLeft = maxLeft;
                if (nextTop > maxTop) nextTop = maxTop;
                card.style.left = nextLeft + 'px';
                card.style.top = nextTop + 'px';
            }
            function stopDrag() {
                if (!drag.active) return;
                drag.active = false;
                card.classList.remove('dragging');
            }
            [card, title, meta].forEach(function (handle) {
                if (handle) handle.addEventListener('mousedown', startDrag);
            });
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('mouseleave', stopDrag);
        }

};
            function startDrag(ev) {
                if (ev.button !== 0) return;
                if (ev.target.closest('button, pre')) return;
                var rect = card.getBoundingClientRect();
                drag.active = true;
                drag.offsetX = ev.clientX - rect.left;
                drag.offsetY = ev.clientY - rect.top;
                card.style.left = rect.left + 'px';
                card.style.top = rect.top + 'px';
                card.style.transform = 'none';
                card.classList.add('dragging');
                ev.preventDefault();
            }

}
            function onMove(ev) {
                if (!drag.active) return;
                var cardRect = card.getBoundingClientRect();
                var width = cardRect.width;
                var height = cardRect.height;
                var nextLeft = ev.clientX - drag.offsetX;
                var nextTop = ev.clientY - drag.offsetY;
                var minLeft = 8;
                var minTop = 8;
                var maxLeft = Math.max(minLeft, window.innerWidth - width - 8);
                var maxTop = Math.max(minTop, window.innerHeight - height - 8);
                if (nextLeft < minLeft) nextLeft = minLeft;
                if (nextTop < minTop) nextTop = minTop;
                if (nextLeft > maxLeft) nextLeft = maxLeft;
                if (nextTop > maxTop) nextTop = maxTop;
                card.style.left = nextLeft + 'px';
                card.style.top = nextTop + 'px';
            }

}
            function stopDrag() {
                if (!drag.active) return;
                drag.active = false;
                card.classList.remove('dragging');
            }

}

        function setAllBreakpoints(enabled) {
            [
                'bpFileSelected', 'bpGpxParsed', 'bpTrackSimplified', 'bpTrackAnalyzed',
                'bpOsmLoadStart', 'bpOverpassBefore', 'bpOverpassAfter', 'bpGraphBuilt',
                'bpAutoPoints', 'bpRoutePieces', 'bpManualSegment'
            ].forEach(function (key) {
                if (els[key]) els[key].checked = !!enabled;
            });
            syncBreakpointConfigFromUi();
        }

}

        function syncBreakpointConfigFromUi() {
            state.debug.breakpointsEnabled = !!(els.breakpointsEnabled && els.breakpointsEnabled.checked);
            state.debug.breakpoints.fileSelected = !!(els.bpFileSelected && els.bpFileSelected.checked);
            state.debug.breakpoints.gpxParsed = !!(els.bpGpxParsed && els.bpGpxParsed.checked);
            state.debug.breakpoints.trackSimplified = !!(els.bpTrackSimplified && els.bpTrackSimplified.checked);
            state.debug.breakpoints.trackAnalyzed = !!(els.bpTrackAnalyzed && els.bpTrackAnalyzed.checked);
            state.debug.breakpoints.osmLoadStart = !!(els.bpOsmLoadStart && els.bpOsmLoadStart.checked);
            state.debug.breakpoints.overpassBefore = !!(els.bpOverpassBefore && els.bpOverpassBefore.checked);
            state.debug.breakpoints.overpassAfter = !!(els.bpOverpassAfter && els.bpOverpassAfter.checked);
            state.debug.breakpoints.graphBuilt = !!(els.bpGraphBuilt && els.bpGraphBuilt.checked);
            state.debug.breakpoints.autoPoints = !!(els.bpAutoPoints && els.bpAutoPoints.checked);
            state.debug.breakpoints.routePieces = !!(els.bpRoutePieces && els.bpRoutePieces.checked);
            state.debug.breakpoints.manualSegment = !!(els.bpManualSegment && els.bpManualSegment.checked);
            state.debug.breakpointStatus = state.debug.breakpointsEnabled ? 'Haltepunkte aktiv.' : 'Haltepunkte pausiert.';
            if (els.breakpointStatus) els.breakpointStatus.textContent = state.debug.breakpointStatus;
        }

}

        function formatBreakpointDetails(details) {
            if (details == null) return 'Keine zusätzlichen Daten.';
            if (typeof details === 'string') return details;
            let text;
            try {
                text = JSON.stringify(details, null, 2);
            } catch (err) {
                text = String(details);
            }
            if (text.length > 5000) return text.slice(0, 5000) + '\n… abgeschnitten …';
            return text;
        }

}

        function resolveBreakpointModal(action) {
            const modalState = state.debug.breakpointModal;
            if (!modalState.pendingResolve || !modalState.pendingReject) return;
            const currentKey = modalState.currentKey;
            const resolve = modalState.pendingResolve;
            const reject = modalState.pendingReject;
            modalState.pendingResolve = null;
            modalState.pendingReject = null;
            hideBreakpointModal();
            if (action === 'skip' && currentKey) {
                modalState.skippedOnce[currentKey] = true;
                resolve('skip');
                return;
            }
            if (action === 'abort') {
                reject(new Error('Durch Benutzer am Haltepunkt abgebrochen: ' + (modalState.currentLabel || currentKey || 'unbekannt')));
                return;
            }
            resolve('continue');
        }

}

        function hideBreakpointModal() {
            if (!els.breakpointModal) return;
            els.breakpointModal.classList.add('hidden');
            els.breakpointModal.setAttribute('aria-hidden', 'true');
        }

}

        async function debugBreakpoint(key, label, details) {
            const bps = state.debug.breakpoints || {};
            const modalState = state.debug.breakpointModal;
            if (!state.debug.breakpointsEnabled || !bps[key]) return;
            if (modalState.skippedOnce[key]) {
                delete modalState.skippedOnce[key];
                logEvent('Haltepunkt einmalig übersprungen: ' + label, 'warn');
                return;
            }
            const detailText = formatBreakpointDetails(details);
            state.debug.breakpointStatus = 'Warte bei: ' + label;
            if (els.breakpointStatus) els.breakpointStatus.textContent = state.debug.breakpointStatus;
            logEvent('Haltepunkt erreicht: ' + label, 'warn', detailText);
            if (!els.breakpointModal) return;
            els.breakpointModalTitle.textContent = 'Haltepunkt: ' + label;
            els.breakpointModalMeta.textContent = 'Der Ablauf ist angehalten. Prüfe Karte, Konsole und Log und gib den nächsten Schritt frei.';
            els.breakpointModalDetails.textContent = detailText;
            els.breakpointModal.classList.remove('hidden');
            els.breakpointModal.setAttribute('aria-hidden', 'false');
            modalState.currentKey = key;
            modalState.currentLabel = label;
            await new Promise(function (resolve, reject) {
                modalState.pendingResolve = resolve;
                modalState.pendingReject = reject;
            });
            state.debug.breakpointStatus = 'Letzter Halt: ' + label;
            if (els.breakpointStatus) els.breakpointStatus.textContent = state.debug.breakpointStatus;
        }

}

        function logEvent(message, level, details) {
            const lvl = level || 'info';
            const stamp = new Date().toLocaleTimeString('de-DE', { hour12: false });
            const line = '[' + stamp + '] [' + lvl.toUpperCase() + '] ' + message + (details ? '\n' + details : '');
            state.debug.logs.push(line);
            if (state.debug.logs.length > 400) state.debug.logs = state.debug.logs.slice(-400);
            if (els.logPanel) els.logPanel.textContent = state.debug.logs.join('\n\n');
            try {
                if (lvl === 'error') console.error(message, details || '');
                else if (lvl === 'warn') console.warn(message, details || '');
                else console.log(message, details || '');
            } catch (err) {}
        }

}

        function clearLogPanel() {
            state.debug.logs = [];
            if (els.logPanel) els.logPanel.textContent = 'Log geleert.';
        }

}

        function setTiming(key, value) {
            state.debug.timings[key] = value;
            refreshDebugPreview();
        }

}

        function refreshDebugPreview() {
            if (els.queryPreview) els.queryPreview.textContent = state.debug.lastQuery || '–';
            const counts = state.debug.counters || {};
            const timingLines = Object.keys(state.debug.timings).map(function (k) { return k + ': ' + state.debug.timings[k]; });
            const parts = [
                'Endpoint: ' + (state.debug.lastEndpoint || '–'),
                'Elemente: ' + (counts.elements != null ? counts.elements : '–'),
                'Relationen: ' + (counts.relations != null ? counts.relations : '–'),
                'Wege: ' + (counts.ways != null ? counts.ways : '–'),
                'Knoten: ' + (counts.nodes != null ? counts.nodes : '–'),
                '',
                timingLines.join('\n')
            ];
            if (els.responsePreview) els.responsePreview.textContent = parts.join('\n').trim() || '–';
        }
