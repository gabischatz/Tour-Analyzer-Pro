'use strict';

window.TAP = window.TAP || {};
var TAP = window.TAP;
var state = TAP.state;
var els = TAP.els;


}

        function initMap() {
            state.map = L.map('map').setView([51.15, 10.65], 8);
            const tileServers = [
                {
                    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
                    options: {
                        attribution: '© OpenStreetMap-Mitwirkende | Darstellung: Lutz Müller',
                        subdomains: 'abcd',
                        maxZoom: 19
                    }
                },
                {
                    url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
                    options: {
                        attribution: '© OpenStreetMap-Mitwirkende',
                        maxZoom: 18
                    }
                }
            ];
            let activeLayer = L.tileLayer(tileServers[0].url, tileServers[0].options).addTo(state.map);
            activeLayer.on('tileerror', function () {
                state.map.removeLayer(activeLayer);
                activeLayer = L.tileLayer(tileServers[1].url, tileServers[1].options).addTo(state.map);
            });
            state.map.on('contextmenu', onMapContextMenu);
            state.map.getContainer().addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
            document.addEventListener('click', function (ev) {
                if (state.contextMenu && !state.contextMenu.contains(ev.target)) closeContextMenu();
            });
        }

}

        function bindVisibilityControls() {
            [
                'showRecorded', 'showOutbound', 'showReturnTrip', 'showCommon',
                'showOsmRoutes', 'showAutoPoints', 'showAutoPieces', 'showSelected', 'showMarkers'
            ].forEach(function (key) {
                if (els[key]) els[key].addEventListener('change', syncVisibilityFromUi);
            });
            syncVisibilityFromUi();
        }

}

        function toggleSidebar() {
            document.body.classList.toggle('sidebar-collapsed');
            if (els.toggleSidebarBtn) {
                els.toggleSidebarBtn.textContent = document.body.classList.contains('sidebar-collapsed')
                    ? '☰ Optionen einblenden'
                    : '☰ Optionen ausblenden';
            }
            setTimeout(function () {
                if (state.map) state.map.invalidateSize();
            }, 260);
        }

}

        function setCheckboxValue(key, value) {
            if (els[key]) els[key].checked = !!value;
        }

}

        function applyPresetAllLayers() {
            setCheckboxValue('showRecorded', true);
            setCheckboxValue('showOutbound', true);
            setCheckboxValue('showReturnTrip', true);
            setCheckboxValue('showCommon', true);
            setCheckboxValue('showOsmRoutes', true);
            setCheckboxValue('showAutoPoints', true);
            setCheckboxValue('showAutoPieces', true);
            setCheckboxValue('showSelected', true);
            setCheckboxValue('showMarkers', true);
            syncVisibilityFromUi();
        }

}

        function applyPresetResultLayers() {
            setCheckboxValue('showRecorded', false);
            setCheckboxValue('showOutbound', true);
            setCheckboxValue('showReturnTrip', true);
            setCheckboxValue('showCommon', true);
            setCheckboxValue('showOsmRoutes', false);
            setCheckboxValue('showAutoPoints', false);
            setCheckboxValue('showAutoPieces', true);
            setCheckboxValue('showSelected', true);
            setCheckboxValue('showMarkers', true);
            syncVisibilityFromUi();
        }

}

        function applyPresetDebugLayers() {
            setCheckboxValue('showRecorded', true);
            setCheckboxValue('showOutbound', true);
            setCheckboxValue('showReturnTrip', true);
            setCheckboxValue('showCommon', true);
            setCheckboxValue('showOsmRoutes', true);
            setCheckboxValue('showAutoPoints', true);
            setCheckboxValue('showAutoPieces', true);
            setCheckboxValue('showSelected', true);
            setCheckboxValue('showMarkers', true);
            syncVisibilityFromUi();
        }

}

        function syncVisibilityFromUi() {
            applyOverlayVisibility('recorded', els.showRecorded && els.showRecorded.checked);
            applyOverlayVisibility('outbound', els.showOutbound && els.showOutbound.checked);
            applyOverlayVisibility('returnTrip', els.showReturnTrip && els.showReturnTrip.checked);
            const commonVisible = els.showCommon && els.showCommon.checked;
            applyOverlayVisibility('commonBase', commonVisible);
            applyOverlayVisibility('commonDots', commonVisible);
            applyOverlayVisibility('osmRoutes', els.showOsmRoutes && els.showOsmRoutes.checked);
            applyOverlayVisibility('autoPoints', els.showAutoPoints && els.showAutoPoints.checked);
            applyOverlayVisibility('autoRoutePieces', els.showAutoPieces && els.showAutoPieces.checked);
            applyOverlayVisibility('selected', els.showSelected && els.showSelected.checked);
            const markerVisible = els.showMarkers && els.showMarkers.checked;
            ['A', 'B', 'start', 'pivot', 'end'].forEach(function (name) {
                applyMarkerVisibility(name, markerVisible);
            });
        }

}

        function applyOverlayVisibility(name, visible) {
            const layer = state.overlay[name];
            if (!layer || !state.map) return;
            if (visible) {
                if (!state.map.hasLayer(layer)) layer.addTo(state.map);
            } else if (state.map.hasLayer(layer)) {
                state.map.removeLayer(layer);
            }
        }

}

        function applyMarkerVisibility(name, visible) {
            const marker = state.markers[name];
            if (!marker || !state.map) return;
            if (visible) {
                if (!state.map.hasLayer(marker)) marker.addTo(state.map);
            } else if (state.map.hasLayer(marker)) {
                state.map.removeLayer(marker);
            }
        }

}

        function drawTrackAnalysis(analysis) {
            clearOverlay('recorded');
            clearOverlay('outbound');
            clearOverlay('returnTrip');
            clearOverlay('commonBase');
            clearOverlay('commonDots');
            clearOverlay('selected');
            clearOverlay('autoRoutePieces');

            state.overlay.recorded = L.polyline(
                state.trackPoints.map(function (p) { return [p.lat, p.lng]; }),
                { color: '#facc15', weight: 8, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }
            ).addTo(state.map);

            state.overlay.outbound = L.layerGroup().addTo(state.map);
            for (let i = 0; i < analysis.outboundPolylines.length; i++) {
                L.polyline(analysis.outboundPolylines[i], {
                    color: '#2563eb',
                    weight: 5,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(state.overlay.outbound);
            }

            state.overlay.returnTrip = L.layerGroup().addTo(state.map);
            for (let i = 0; i < analysis.returnPolylines.length; i++) {
                L.polyline(analysis.returnPolylines[i], {
                    color: '#dc2626',
                    weight: 5,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(state.overlay.returnTrip);
            }

            state.overlay.commonBase = L.layerGroup().addTo(state.map);
            state.overlay.commonDots = L.layerGroup().addTo(state.map);
            for (let i = 0; i < analysis.commonPolylines.length; i++) {
                const line = analysis.commonPolylines[i];
                L.polyline(line, {
                    color: '#facc15',
                    weight: 9,
                    opacity: 1,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(state.overlay.commonBase);
                L.polyline(line, {
                    color: '#dc2626',
                    weight: 3,
                    opacity: 1,
                    dashArray: '2,9',
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(state.overlay.commonDots);
            }

            const bounds = L.latLngBounds(state.trackPoints.map(function (p) { return [p.lat, p.lng]; }));
            if (bounds.isValid()) state.map.fitBounds(bounds.pad(0.08));

            els.statTotal.textContent = formatKm(analysis.allDistance);
            els.statOutbound.textContent = formatKm(analysis.outboundDistance);
            els.statReturn.textContent = formatKm(analysis.returnDistance);
            els.statCommon.textContent = formatKm(analysis.commonDistance);
            els.statSegment.textContent = state.autoPoints.length + ' Punkte';
            syncVisibilityFromUi();
        }

}

        function placeTrackMarkers(analysis) {
            clearMarker('start');
            clearMarker('pivot');
            clearMarker('end');

            const start = state.trackPoints[0];
            const pivot = analysis.pivotPoint;
            const end = state.trackPoints[state.trackPoints.length - 1];

            state.markers.start = L.circleMarker([start.lat, start.lng], {
                radius: 8, color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.9, weight: 2
            }).bindPopup('Start').addTo(state.map);

            state.markers.pivot = L.circleMarker([pivot.lat, pivot.lng], {
                radius: 8, color: '#92400e', fillColor: '#f59e0b', fillOpacity: 0.9, weight: 2
            }).bindPopup('Wendepunkt (automatisch)').addTo(state.map);

            state.markers.end = L.circleMarker([end.lat, end.lng], {
                radius: 8, color: '#7f1d1d', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2
            }).bindPopup('Ende').addTo(state.map);
            syncVisibilityFromUi();
        }

}

        function drawAutoPoints(points) {
            clearOverlay('autoPoints');
            state.overlay.autoPoints = L.layerGroup().addTo(state.map);
            for (let i = 0; i < points.length; i++) {
                const pt = points[i];
                L.marker([pt.lat, pt.lng], {
                    icon: L.divIcon({
                        className: pt.type === 'turn' ? 'turn-pin' : 'div-pin',
                        iconSize: pt.type === 'turn' ? [12, 12] : [14, 14],
                        html: ''
                    })
                }).bindPopup(pt.msg).addTo(state.overlay.autoPoints);
            }
            syncVisibilityFromUi();
        }

}

        function onMapContextMenu(ev) {
            closeContextMenu();
            const p = state.map.latLngToContainerPoint(ev.latlng);
            const rect = state.map.getContainer().getBoundingClientRect();
            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.style.left = (rect.left + p.x) + 'px';
            menu.style.top = (rect.top + p.y) + 'px';

            const btnA = document.createElement('button');
            btnA.textContent = '🔵 Punkt A hier setzen (optional)';
            btnA.onclick = function () { setManualPoint('A', ev.latlng.lat, ev.latlng.lng); closeContextMenu(); };

            const btnB = document.createElement('button');
            btnB.textContent = '🔴 Punkt B hier setzen (optional)';
            btnB.onclick = function () { setManualPoint('B', ev.latlng.lat, ev.latlng.lng); closeContextMenu(); };

            const btnCancel = document.createElement('button');
            btnCancel.textContent = '❌ Abbrechen';
            btnCancel.onclick = function () { closeContextMenu(); };

            menu.appendChild(btnA);
            menu.appendChild(btnB);
            menu.appendChild(btnCancel);
            document.body.appendChild(menu);
            state.contextMenu = menu;
        }

}

        function closeContextMenu() {
            if (state.contextMenu) {
                state.contextMenu.remove();
                state.contextMenu = null;
            }
        }

}

        function setManualPoint(type, lat, lng) {
            const snapped = snapLatLngToTrack(lat, lng);
            if (!snapped) {
                setStatus('Der Punkt konnte nicht an die geladene Strecke angesetzt werden.', 'error');
                return;
            }
            clearMarker(type);
            const markerColor = type === 'A' ? '#2563eb' : '#dc2626';
            state.markers[type] = L.circleMarker([snapped.lat, snapped.lng], {
                radius: 8,
                color: markerColor,
                fillColor: markerColor,
                fillOpacity: 0.88,
                weight: 2
            }).bindPopup('Punkt ' + type + ' (gesnappt auf Track)<br>Index: ' + snapped.index).addTo(state.map);
            state.markers[type].trackIndex = snapped.index;
            if (type === 'A') els.pointA.value = snapped.lat.toFixed(6) + ',' + snapped.lng.toFixed(6) + ' | Index ' + snapped.index;
            else els.pointB.value = snapped.lat.toFixed(6) + ',' + snapped.lng.toFixed(6) + ' | Index ' + snapped.index;
            setStatus('Punkt ' + type + ' gesetzt. Mit beiden Punkten wird ein manueller A→B-Abschnitt berechnet.', 'success');
            syncVisibilityFromUi();
        }

}

        function snapLatLngToTrack(lat, lng) {
            if (!state.trackPoints.length) return null;
            let best = null;
            let bestDist = Infinity;
            for (let i = 0; i < state.trackPoints.length; i++) {
                const p = state.trackPoints[i];
                const d = getDist(lat, lng, p.lat, p.lng);
                if (d < bestDist) {
                    bestDist = d;
                    best = { index: i, lat: p.lat, lng: p.lng, distanceM: d };
                }
            }
            return best;
        }

}

        function drawSinglePiece(piece) {
            const isNetworkPiece = piece.source === 'graph' || piece.source === 'osm';
            const color = isNetworkPiece ? '#7c3aed' : '#111827';
            const dashArray = isNetworkPiece ? null : '8,8';
            L.polyline(piece.coords, {
                color: color,
                weight: 4,
                opacity: 0.92,
                dashArray: dashArray,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(state.overlay.autoRoutePieces);

            const mid = piece.coords[Math.floor(piece.coords.length / 2)];
            if (mid) {
                L.marker(mid, {
                    icon: L.divIcon({
                        className: 'piece-label',
                        iconSize: [20, 20],
                        html: String(piece.pieceNo)
                    })
                }).bindPopup(
                    'Teilstück ' + piece.pieceNo + '<br>' +
                    'Quelle: ' + (piece.source === 'graph' ? 'OSM-Netzpfad' : (piece.source === 'osm' ? 'Einzelner OSM-Way' : 'GPX-Fallback')) + '<br>' +
                    'Länge: ' + formatKm(piece.distanceM) + '<br>' +
                    'Track: ' + piece.fromTrackIndex + ' → ' + piece.toTrackIndex +
                    (piece.wayId ? '<br>OSM-Way: ' + piece.wayId : '')
                ).addTo(state.overlay.autoRoutePieces);
            }
        }

}

        function clearOverlay(name) {
            if (state.overlay[name]) {
                state.map.removeLayer(state.overlay[name]);
                state.overlay[name] = null;
            }
        }

}

        function clearMarker(name) {
            if (state.markers[name]) {
                state.map.removeLayer(state.markers[name]);
                state.markers[name] = null;
            }
        }

}

        function clearAllMarkers() {
            clearMarker('A');
            clearMarker('B');
            clearMarker('start');
            clearMarker('pivot');
            clearMarker('end');
        }

}

        function setStatus(text, type) {
            els.status.textContent = text;
            els.status.className = 'status';
            if (type === 'success') els.status.classList.add('success');
            if (type === 'error') els.status.classList.add('error');
        }
