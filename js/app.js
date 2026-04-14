'use strict';

window.TAP = window.TAP || {};
var TAP = window.TAP;

TAP.state = {
            map: null,
            rawPoints: [],
            trackPoints: [],
            bbox: null,
            relationId: null,
            osmWays: [],
            osmGraph: null,
            autoPoints: [],
            autoRoutePieces: [],
            exportGeoJSON: null,
            analysis: null,
            currentAuthor: '',
            contextMenu: null,
            overlay: {
                recorded: null,
                outbound: null,
                returnTrip: null,
                commonBase: null,
                commonDots: null,
                osmRoutes: null,
                autoPoints: null,
                autoRoutePieces: null,
                selected: null
            },
            markers: {
                A: null,
                B: null,
                start: null,
                pivot: null,
                end: null
            },
            selectedSegmentResult: null,
            debug: {
                logs: [],
                lastQuery: '',
                lastEndpoint: '',
                lastOverpassData: null,
                lastResponseText: '–',
                timings: {},
                counters: {},
                breakpointStatus: 'Kein Haltepunkt aktiv.',
                breakpointsEnabled: true,
                breakpoints: {
                    fileSelected: true,
                    gpxParsed: true,
                    trackSimplified: true,
                    trackAnalyzed: true,
                    osmLoadStart: true,
                    overpassBefore: true,
                    overpassAfter: true,
                    graphBuilt: true,
                    autoPoints: true,
                    routePieces: true,
                    manualSegment: true
                },
                breakpointModal: {
                    currentKey: '',
                    currentLabel: '',
                    skippedOnce: {},
                    pendingResolve: null,
                    pendingReject: null
                }
            }
        };

TAP.els = {
            fileInput: document.getElementById('gpxFileInput'),
            reloadOsmBtn: document.getElementById('reloadOsmBtn'),
            extractBtn: document.getElementById('extractBtn'),
            exportBtn: document.getElementById('exportBtn'),
            resetBtn: document.getElementById('resetBtn'),
            relationIdInput: document.getElementById('relationIdInput'),
            pointA: document.getElementById('pointA'),
            pointB: document.getElementById('pointB'),
            status: document.getElementById('status'),
            metaDisplay: document.getElementById('metaDisplay'),
            statTotal: document.getElementById('statTotal'),
            statOutbound: document.getElementById('statOutbound'),
            statReturn: document.getElementById('statReturn'),
            statCommon: document.getElementById('statCommon'),
            statSegment: document.getElementById('statSegment'),
            statRoutes: document.getElementById('statRoutes'),
            exportCombinedBtn: document.getElementById('exportCombinedBtn'),
            exportFinalRouteBtn: document.getElementById('exportFinalRouteBtn'),
            exportFinalRouteGpxBtn: document.getElementById('exportFinalRouteGpxBtn'),
            exportPiecesBtn: document.getElementById('exportPiecesBtn'),
            exportOsmBtn: document.getElementById('exportOsmBtn'),
            exportPointsBtn: document.getElementById('exportPointsBtn'),
            exportRawOverpassBtn: document.getElementById('exportRawOverpassBtn'),
            exportDebugBtn: document.getElementById('exportDebugBtn'),
            clearLogBtn: document.getElementById('clearLogBtn'),
            queryPreview: document.getElementById('queryPreview'),
            responsePreview: document.getElementById('responsePreview'),
            logPanel: document.getElementById('logPanel'),
            toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
            presetAllBtn: document.getElementById('presetAllBtn'),
            presetResultBtn: document.getElementById('presetResultBtn'),
            presetDebugBtn: document.getElementById('presetDebugBtn'),
            showRecorded: document.getElementById('showRecorded'),
            showOutbound: document.getElementById('showOutbound'),
            showReturnTrip: document.getElementById('showReturnTrip'),
            showCommon: document.getElementById('showCommon'),
            showOsmRoutes: document.getElementById('showOsmRoutes'),
            showAutoPoints: document.getElementById('showAutoPoints'),
            showAutoPieces: document.getElementById('showAutoPieces'),
            showSelected: document.getElementById('showSelected'),
            showMarkers: document.getElementById('showMarkers'),
            breakpointsEnabled: document.getElementById('breakpointsEnabled'),
            breakpointsAllBtn: document.getElementById('breakpointsAllBtn'),
            breakpointsNoneBtn: document.getElementById('breakpointsNoneBtn'),
            breakpointStatus: document.getElementById('breakpointStatus'),
            breakpointModal: document.getElementById('breakpointModal'),
            breakpointModalTitle: document.getElementById('breakpointModalTitle'),
            breakpointModalMeta: document.getElementById('breakpointModalMeta'),
            breakpointModalDetails: document.getElementById('breakpointModalDetails'),
            breakpointContinueBtn: document.getElementById('breakpointContinueBtn'),
            breakpointSkipBtn: document.getElementById('breakpointSkipBtn'),
            breakpointAbortBtn: document.getElementById('breakpointAbortBtn'),
            bpFileSelected: document.getElementById('bpFileSelected'),
            bpGpxParsed: document.getElementById('bpGpxParsed'),
            bpTrackSimplified: document.getElementById('bpTrackSimplified'),
            bpTrackAnalyzed: document.getElementById('bpTrackAnalyzed'),
            bpOsmLoadStart: document.getElementById('bpOsmLoadStart'),
            bpOverpassBefore: document.getElementById('bpOverpassBefore'),
            bpOverpassAfter: document.getElementById('bpOverpassAfter'),
            bpGraphBuilt: document.getElementById('bpGraphBuilt'),
            bpAutoPoints: document.getElementById('bpAutoPoints'),
            bpRoutePieces: document.getElementById('bpRoutePieces'),
            bpManualSegment: document.getElementById('bpManualSegment')
        };

var state = TAP.state;
var els = TAP.els;

TAP.initApp = function initApp() {
    initMap();
    bindEvents();
    bindVisibilityControls();
    bindBreakpointControls();
    initBreakpointCardTools();
    refreshDebugPreview();
};


}

        function bindEvents() {
            els.fileInput.addEventListener('change', onFileSelected);
            els.reloadOsmBtn.addEventListener('click', loadOsmRoutesForCurrentTrack);
            els.extractBtn.addEventListener('click', handleSegmentCalculationRequest);
            els.exportBtn.addEventListener('click', exportGeoJSONFile);
            els.exportCombinedBtn.addEventListener('click', exportGeoJSONFile);
            els.exportFinalRouteBtn.addEventListener('click', exportFinalRouteGeoJSONFile);
            els.exportFinalRouteGpxBtn.addEventListener('click', exportFinalRouteGpxFile);
            els.exportPiecesBtn.addEventListener('click', exportPiecesGeoJSONFile);
            els.exportOsmBtn.addEventListener('click', exportOsmGeoJSONFile);
            els.exportPointsBtn.addEventListener('click', exportAutoPointsGeoJSONFile);
            els.exportRawOverpassBtn.addEventListener('click', exportRawOverpassFile);
            els.exportDebugBtn.addEventListener('click', exportDebugBundleFile);
            els.clearLogBtn.addEventListener('click', clearLogPanel);
            els.resetBtn.addEventListener('click', resetAll);
            if (els.toggleSidebarBtn) els.toggleSidebarBtn.addEventListener('click', toggleSidebar);
            if (els.presetAllBtn) els.presetAllBtn.addEventListener('click', applyPresetAllLayers);
            if (els.presetResultBtn) els.presetResultBtn.addEventListener('click', applyPresetResultLayers);
            if (els.presetDebugBtn) els.presetDebugBtn.addEventListener('click', applyPresetDebugLayers);
        }

}

        function setExportButtonsEnabled(enabled) {
            const val = !enabled;
            els.exportBtn.disabled = val;
            els.exportCombinedBtn.disabled = val;
            els.exportFinalRouteBtn.disabled = val;
            els.exportFinalRouteGpxBtn.disabled = val;
            els.exportPiecesBtn.disabled = val;
            els.exportOsmBtn.disabled = val;
            els.exportPointsBtn.disabled = val;
            els.exportRawOverpassBtn.disabled = val;
            els.exportDebugBtn.disabled = val;
        }

}

        function resetAll() {
            state.rawPoints = [];
            state.trackPoints = [];
            state.bbox = null;
            state.relationId = null;
            state.osmWays = [];
            state.osmGraph = null;
            state.autoPoints = [];
            state.autoRoutePieces = [];
            state.exportGeoJSON = null;
            state.analysis = null;
            state.debug.logs = [];
            state.debug.lastQuery = '';
            state.debug.lastEndpoint = '';
            state.debug.lastOverpassData = null;
            state.debug.lastResponseText = '–';
            state.debug.timings = {};
            state.debug.counters = {};
            state.debug.breakpointStatus = 'Kein Haltepunkt aktiv.';
            state.debug.breakpointModal.skippedOnce = {};
            hideBreakpointModal();
            refreshDebugPreview();
            clearAllMarkers();
            resetMapLayersOnly();
            els.fileInput.value = '';
            els.pointA.value = '';
            els.pointB.value = '';
            els.reloadOsmBtn.disabled = true;
            els.extractBtn.disabled = true;
            setExportButtonsEnabled(false);
            els.statTotal.textContent = '–';
            els.statOutbound.textContent = '–';
            els.statReturn.textContent = '–';
            els.statCommon.textContent = '–';
            els.statSegment.textContent = '–';
            els.statRoutes.textContent = '–';
            if (els.logPanel) els.logPanel.textContent = 'Noch keine Log-Einträge.';
            if (els.breakpointStatus) els.breakpointStatus.textContent = state.debug.breakpointStatus;
            setStatus('Zurückgesetzt. Bitte eine GPX-Datei laden.', '');
            applyPresetAllLayers();
        }

}

        function resetMapLayersOnly() {
            clearOverlay('recorded');
            clearOverlay('outbound');
            clearOverlay('returnTrip');
            clearOverlay('commonBase');
            clearOverlay('commonDots');
            clearOverlay('osmRoutes');
            clearOverlay('autoPoints');
            clearOverlay('autoRoutePieces');
            clearOverlay('selected');
        }

}

        function computeBounds(points, padDeg) {
            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                if (p.lat < minLat) minLat = p.lat;
                if (p.lat > maxLat) maxLat = p.lat;
                if (p.lng < minLng) minLng = p.lng;
                if (p.lng > maxLng) maxLng = p.lng;
            }
            return {
                s: round(minLat - padDeg, 6),
                w: round(minLng - padDeg, 6),
                n: round(maxLat + padDeg, 6),
                e: round(maxLng + padDeg, 6)
            };
        }

}

        function midpointLatLng(lat1, lng1, lat2, lng2) {
            return { lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 };
        }

}

        function sumPointsDistance(points) {
            let sum = 0;
            for (let i = 1; i < points.length; i++) {
                const a = points[i - 1];
                const b = points[i];
                sum += getDist(a.lat, a.lng, b.lat, b.lng);
            }
            return sum;
        }

}

        function sumSegments(segments) {
            let sum = 0;
            for (let i = 0; i < segments.length; i++) sum += segments[i].distanceM;
            return sum;
        }

}

        function formatKm(meters) {
            return (meters / 1000).toFixed(2) + ' km';
        }

}

        function round(val, n) {
            const precision = Number.isInteger(n) ? n : 2;
            return Number(Number(val).toFixed(precision));
        }

}

        function delay(ms) {
            return new Promise(function (resolve) { setTimeout(resolve, ms); });
        }

}

        function getDist(lat1, lon1, lat2, lon2) {
            const R = 6371000;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

}

        function bearing(lat1, lon1, lat2, lon2) {
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
            const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
            return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }
