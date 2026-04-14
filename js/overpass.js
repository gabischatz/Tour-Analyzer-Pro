'use strict';

window.TAP = window.TAP || {};
var TAP = window.TAP;
var state = TAP.state;
var els = TAP.els;


}

        async function loadOsmRoutesForCurrentTrack() {
            if (!state.bbox) {
                setStatus('Es ist noch keine GPX-Strecke geladen.', 'error');
                return;
            }
            const relationIdRaw = els.relationIdInput.value.trim();
            state.relationId = relationIdRaw ? Number(relationIdRaw) : null;

            const tLoadOsm = performance.now();
            clearOverlay('osmRoutes');
            clearOverlay('autoRoutePieces');
            state.autoRoutePieces = [];
            setStatus('OSM-Radrouten werden geladen …', '');

            try {
                let ways = [];
                if (state.relationId) ways = await loadWaysByRelationId(state.relationId);
                else ways = await loadWaysByTrackBbox(state.bbox);

                logEvent('OSM-Wege geladen: ' + ways.length + ' Kandidaten nach Filterung.');
                await debugBreakpoint('overpassAfter', 'Overpass verarbeitet', {
                    endpoint: state.debug.lastEndpoint || null,
                    elements: state.debug.counters.elements || 0,
                    relations: state.debug.counters.relations || 0,
                    rawWays: state.debug.counters.ways || 0,
                    eligibleWays: ways.length
                });
                state.osmWays = ways;
                const tGraph = performance.now();
                state.osmGraph = buildOsmGraph(ways);
                setTiming('Graph-Aufbau', round(performance.now() - tGraph, 1) + ' ms');
                logEvent('OSM-Graph aufgebaut: ' + state.osmGraph.nodeList.length + ' Knoten.');
                await debugBreakpoint('graphBuilt', 'OSM-Graph aufgebaut', {
                    nodes: state.osmGraph.nodeList.length,
                    ways: ways.length
                });
                state.overlay.osmRoutes = L.layerGroup().addTo(state.map);
                for (let i = 0; i < ways.length; i++) {
                    const coords = ways[i].geometry.map(function (pt) { return [pt.lat, pt.lon]; });
                    L.polyline(coords, {
                        color: '#16a34a',
                        weight: 4,
                        opacity: 0.72,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }).addTo(state.overlay.osmRoutes);
                }
                els.statRoutes.textContent = ways.length + ' Wege / ' + state.osmGraph.nodeList.length + ' Knoten';
                syncVisibilityFromUi();
                const tAuto = performance.now();
                state.autoPoints = detectAutoPoints(state.trackPoints);
                state.autoPoints = refineAutoPointsWithOsm(state.trackPoints, state.autoPoints, state.osmWays);
                state.autoPoints = refineAutoPointsWithGraph(state.trackPoints, state.autoPoints, state.osmGraph);
                setTiming('Punkt-Erkennung', round(performance.now() - tAuto, 1) + ' ms');
                logEvent('Automatische Punkte: ' + state.autoPoints.length);
                await debugBreakpoint('autoPoints', 'Automatische Punkte erkannt', {
                    count: state.autoPoints.length,
                    sample: state.autoPoints.slice(0, 8).map(function (pt) { return { type: pt.type, label: pt.label, trackIndex: pt.trackIndex }; })
                });
                drawAutoPoints(state.autoPoints);
                const tPieces = performance.now();
                calculateAutomaticRoutePieces(false);
                setTiming('Teilstücke', round(performance.now() - tPieces, 1) + ' ms');
                await debugBreakpoint('routePieces', 'Teilstücke berechnet', {
                    count: state.autoRoutePieces.length,
                    sample: state.autoRoutePieces.slice(0, 6).map(function (piece) { return { pieceNo: piece.pieceNo, source: piece.source, from: piece.fromTrackIndex, to: piece.toTrackIndex, distanceM: round(piece.distanceM, 1) }; })
                });
                setTiming('OSM-Gesamt', round(performance.now() - tLoadOsm, 1) + ' ms');
                if (state.relationId) setStatus('OSM-Relation ' + state.relationId + ' geladen. Bereich → Netz → Punkte → Teilstücke wurde berechnet.', 'success');
                else setStatus('OSM-Netz im GPX-Bereich geladen. Danach wurden die Punkte erkannt und die Teilstücke auf dem Netz berechnet.', 'success');
            } catch (err) {
                console.error(err);
                els.statRoutes.textContent = '0 Wege';
                logEvent('OSM-Laden fehlgeschlagen: ' + err.message, 'error');
                state.osmGraph = null;
                const tAuto = performance.now();
                state.autoPoints = detectAutoPoints(state.trackPoints);
                drawAutoPoints(state.autoPoints);
                calculateAutomaticRoutePieces(true);
                setStatus('Fehler beim Laden des OSM-Netzes: ' + err.message + '. Teilstücke wurden nur auf Basis der GPX-Strecke berechnet.', 'error');
            }
        }

}

        async function loadWaysByTrackBbox(bbox) {
            const query = '[out:json][timeout:120];(' +
                'relation["type"="route"]["route"="bicycle"](' + bbox.s + ',' + bbox.w + ',' + bbox.n + ',' + bbox.e + ');' +
                'relation["route"="bicycle"]["network"~"^(lcn|rcn|ncn)$"](' + bbox.s + ',' + bbox.w + ',' + bbox.n + ',' + bbox.e + ');' +
                'way["highway"~"cycleway|path|track|service|footway|living_street|residential|unclassified|tertiary|secondary|primary"](' + bbox.s + ',' + bbox.w + ',' + bbox.n + ',' + bbox.e + ');' +
                'way["bicycle_road"="yes"](' + bbox.s + ',' + bbox.w + ',' + bbox.n + ',' + bbox.e + ');' +
                'way["cyclestreet"="yes"](' + bbox.s + ',' + bbox.w + ',' + bbox.n + ',' + bbox.e + ');' +
                'way["cycleway"](' + bbox.s + ',' + bbox.w + ',' + bbox.n + ',' + bbox.e + ');' +
                ');out body;>;out geom qt;';
            await debugBreakpoint('overpassBefore', 'Overpass senden', {
                mode: 'bbox-full-snapshot',
                bbox: bbox,
                note: 'Es wird bewusst der komplette OSM-Schnappschuss für diese Box geladen und danach lokal weiterverarbeitet.',
                query: query
            });
            const data = await fetchOverpass(query);
            let ways = extractWayGeometries(data);
            const extractedWays = ways.length;
            ways = ways.filter(isBikeEligibleWay);
            const eligibleWays = ways.length;
            logEvent('OSM-Filterung: ' + extractedWays + ' Wege extrahiert, ' + eligibleWays + ' radgeeignet, kein GPX-Korridorfilter aktiv.');
            state.debug.snapshotMode = 'full_bbox_dataset';
            state.debug.counters.extractedWays = extractedWays;
            state.debug.counters.eligibleWays = eligibleWays;
            state.debug.counters.corridorWays = eligibleWays;
            return ways;
        }

}

        async function loadWaysByRelationId(relationId) {
            const query = '[out:json][timeout:90];relation(' + relationId + ');(._;>;);out geom;';
            const data = await fetchOverpass(query);
            return extractWayGeometries(data).filter(function (way) { return way.geometry && way.geometry.length > 1; });
        }

}

        async function fetchOverpass(query) {
            state.debug.lastQuery = query;
            refreshDebugPreview();
            const endpoints = [
                'https://overpass-api.de/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter',
                'https://overpass.openstreetmap.ru/api/interpreter'
            ];
            let lastError = 'Unbekannter Fehler';
            for (let attempt = 0; attempt < 3; attempt++) {
                for (let i = 0; i < endpoints.length; i++) {
                    const endpoint = endpoints[i];
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(function () { controller.abort(); }, 35000);
                        logEvent('Overpass-Versuch ' + (attempt + 1) + ' über ' + endpoint);
                        const tFetch = performance.now();
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                                'Accept': 'application/json'
                            },
                            body: 'data=' + encodeURIComponent(query),
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);
                        if (response.status === 429) {
                            logEvent('Rate-Limit von ' + endpoint, 'warn');
                            lastError = 'Rate-Limit bei ' + endpoint;
                            await delay(3500 + attempt * 1500);
                            continue;
                        }
                        if (!response.ok) {
                            lastError = 'HTTP ' + response.status + ' bei ' + endpoint;
                            continue;
                        }
                        const data = await response.json();
                        state.debug.lastEndpoint = endpoint;
                        state.debug.lastOverpassData = data;
                        state.debug.counters = {
                            elements: data && data.elements ? data.elements.length : 0,
                            relations: data && data.elements ? data.elements.filter(function (el) { return el.type === 'relation'; }).length : 0,
                            ways: data && data.elements ? data.elements.filter(function (el) { return el.type === 'way'; }).length : 0,
                            nodes: data && data.elements ? data.elements.filter(function (el) { return el.type === 'node'; }).length : 0
                        };
                        setTiming('Overpass-Request', round(performance.now() - tFetch, 1) + ' ms');
                        refreshDebugPreview();
                        logEvent('Overpass-Antwort von ' + endpoint + ': ' + state.debug.counters.elements + ' Elemente, ' + state.debug.counters.ways + ' Wege, ' + state.debug.counters.relations + ' Relationen.');
                        if (!data || !data.elements) {
                            lastError = 'Overpass lieferte kein gültiges JSON';
                            continue;
                        }
                        return data;
                    } catch (err) {
                        lastError = err && err.message ? err.message : String(err);
                        logEvent('Fehler bei ' + endpoint + ': ' + lastError, 'warn');
                    }
                }
                await delay(1800 + attempt * 1200);
            }
            throw new Error(lastError);
        }

}

        function extractWayGeometries(data) {
            const elements = data && data.elements ? data.elements : [];
            const byId = new Map();
            const relationMembership = new Map();

            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                if (el.type !== 'relation') continue;
                const tags = el.tags || {};
                if (tags.route !== 'bicycle') continue;
                const members = el.members || [];
                for (let j = 0; j < members.length; j++) {
                    const member = members[j];
                    if (member.type !== 'way') continue;
                    if (!relationMembership.has(member.id)) {
                        relationMembership.set(member.id, {
                            relationIds: [],
                            relationNames: [],
                            relationNetworks: []
                        });
                    }
                    const info = relationMembership.get(member.id);
                    info.relationIds.push(el.id);
                    if (tags.name) info.relationNames.push(tags.name);
                    if (tags.network) info.relationNetworks.push(tags.network);
                }
            }

            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
                const info = relationMembership.get(el.id) || { relationIds: [], relationNames: [], relationNetworks: [] };
                byId.set(el.id, {
                    id: el.id,
                    type: el.type,
                    tags: el.tags || {},
                    geometry: el.geometry,
                    relationIds: info.relationIds,
                    relationNames: info.relationNames,
                    relationNetworks: info.relationNetworks
                });
            }
            return Array.from(byId.values());
        }

}

        function isBikeEligibleWay(way) {
            const tags = way.tags || {};
            const highway = tags.highway || '';
            const bicycle = String(tags.bicycle || '').toLowerCase();
            const access = String(tags.access || '').toLowerCase();
            const vehicle = String(tags.vehicle || tags.motor_vehicle || '').toLowerCase();
            const explicitBikeYes = /^(yes|designated|permissive|destination)$/.test(bicycle);
            const blocked = ['no', 'private'].includes(access) || ['no', 'private'].includes(vehicle);
            const hasCycleLane = !!(tags.cycleway || tags['cycleway:left'] || tags['cycleway:right']);

            if (way.relationIds && way.relationIds.length) return true;
            if (bicycle === 'no') return false;
            if (tags.bicycle_road === 'yes' || tags.cyclestreet === 'yes') return true;
            if (highway === 'cycleway') return true;
            if (highway === 'footway') return explicitBikeYes;
            if (highway === 'path' || highway === 'track') return !blocked || explicitBikeYes;
            if (highway === 'service') return !blocked || explicitBikeYes;
            if (/^(residential|living_street|unclassified|tertiary|secondary|primary)$/.test(highway)) {
                if (blocked && !explicitBikeYes) return false;
                return bicycle !== 'no' || explicitBikeYes || hasCycleLane;
            }
            return explicitBikeYes;
        }

}

        function filterWaysToTrackCorridor(ways, trackPoints, corridorM) {
            if (!trackPoints.length) return ways.slice();
            const trackCoords = trackPoints.map(function (p) { return { lat: p.lat, lng: p.lng }; });
            const out = [];
            for (let i = 0; i < ways.length; i++) {
                const way = ways[i];
                const dynamicCorridor = way.relationIds && way.relationIds.length ? Math.max(corridorM, 240) : corridorM;
                if (wayWithinTrackCorridor(way, trackCoords, dynamicCorridor)) out.push(way);
            }
            return out;
        }

}

        function wayWithinTrackCorridor(way, trackCoords, corridorM) {
            const geom = way.geometry || [];
            if (geom.length < 2) return false;
            const step = Math.max(1, Math.floor(geom.length / 12));
            for (let i = 0; i < geom.length; i += step) {
                if (nearestDistanceToPolyline({ lat: geom[i].lat, lng: geom[i].lon }, trackCoords) <= corridorM) return true;
            }
            const last = geom[geom.length - 1];
            if (nearestDistanceToPolyline({ lat: last.lat, lng: last.lon }, trackCoords) <= corridorM) return true;
            for (let i = 0; i < geom.length - 1; i += step) {
                const mid = midpointLatLng(geom[i].lat, geom[i].lon, geom[i + 1].lat, geom[i + 1].lon);
                if (nearestDistanceToPolyline(mid, trackCoords) <= corridorM) return true;
            }
            return false;
        }

}

        function buildOsmGraph(ways) {
            const nodeMap = new Map();
            const nodeList = [];
            const edgesByNode = new Map();

            function ensureNode(lat, lng) {
                const key = lat.toFixed(7) + ',' + lng.toFixed(7);
                if (!nodeMap.has(key)) {
                    const node = { id: key, lat: lat, lng: lng, degree: 0 };
                    nodeMap.set(key, node);
                    nodeList.push(node);
                    edgesByNode.set(key, []);
                }
                return nodeMap.get(key);
            }

            for (let i = 0; i < ways.length; i++) {
                const way = ways[i];
                const geom = way.geometry || [];
                if (geom.length < 2) continue;
                const preference = computeWayPreferenceFactor(way);
                for (let j = 0; j < geom.length - 1; j++) {
                    const a = ensureNode(geom[j].lat, geom[j].lon);
                    const b = ensureNode(geom[j + 1].lat, geom[j + 1].lon);
                    const dist = getDist(a.lat, a.lng, b.lat, b.lng);
                    if (dist < 1) continue;
                    const mid = midpointLatLng(a.lat, a.lng, b.lat, b.lng);
                    const edge = {
                        from: a.id,
                        to: b.id,
                        distM: dist,
                        midpoint: mid,
                        wayId: way.id || null,
                        tags: way.tags || {},
                        preference: preference
                    };
                    const rev = Object.assign({}, edge, { from: b.id, to: a.id });
                    edgesByNode.get(a.id).push(edge);
                    edgesByNode.get(b.id).push(rev);
                }
            }

            nodeList.forEach(function (node) {
                node.degree = (edgesByNode.get(node.id) || []).length;
            });

            return {
                nodes: nodeMap,
                nodeList: nodeList,
                edgesByNode: edgesByNode
            };
        }

const edgesByNode = new Map();

            function ensureNode(lat, lng) {
                const key = lat.toFixed(7) + ',' + lng.toFixed(7);
                if (!nodeMap.has(key)) {
                    const node = { id: key, lat: lat, lng: lng, degree: 0 };
                    nodeMap.set(key, node);
                    nodeList.push(node);
                    edgesByNode.set(key, []);
                }
                return nodeMap.get(key);
            }

}

        function computeWayPreferenceFactor(way) {
            const tags = way.tags || {};
            const highway = tags.highway || '';
            let factor = 1;
            if (way.relationIds && way.relationIds.length) factor *= 0.62;
            if (tags.bicycle_road === 'yes' || tags.cyclestreet === 'yes') factor *= 0.72;
            if (highway === 'cycleway') factor *= 0.68;
            else if (highway === 'path' || highway === 'track') factor *= 0.84;
            else if (highway === 'service') factor *= 0.93;
            else if (highway === 'footway') factor *= 1.08;
            else factor *= 1.15;
            if (tags.surface && /gravel|ground|dirt|sand|mud/.test(String(tags.surface).toLowerCase())) factor *= 1.06;
            return factor;
        }

}

        function refineAutoPointsWithGraph(trackPoints, autoPoints, graph) {
            if (!graph || !graph.nodeList || !graph.nodeList.length) return autoPoints.slice();
            const refined = [];
            for (let i = 0; i < autoPoints.length; i++) {
                const pt = Object.assign({}, autoPoints[i]);
                const preferred = pt.type === 'div' ? 'junction' : 'any';
                const candidates = findNearestGraphNodeCandidates(graph, pt, trackPoints, pt.trackIndex, preferred, 42, 5);
                if (candidates.length) {
                    const best = candidates[0];
                    pt.lat = best.node.lat;
                    pt.lng = best.node.lng;
                    pt.trackIndex = best.trackIndex;
                    pt.msg += ' | Netz-Snap (' + Math.round(best.distanceM) + ' m)';
                }
                refined.push(pt);
            }
            const injected = injectMissingGraphNodes(trackPoints, refined, graph);
            return normalizeAutoPoints(refined.concat(injected), trackPoints);
        }

}

        function injectMissingGraphNodes(trackPoints, existingPoints, graph) {
            const injected = [];
            for (let i = 0; i < graph.nodeList.length; i++) {
                const node = graph.nodeList[i];
                if (node.degree < 4) continue;
                const nearTrack = nearestTrackIndexToLatLng(trackPoints, node.lat, node.lng, 0, trackPoints.length - 1);
                if (!nearTrack || nearTrack.distanceM > 8) continue;
                const nearestExisting = nearestAutoPointToTrackIndex(existingPoints, nearTrack.index, trackPoints);
                if (nearestExisting && (nearestExisting.idxGap < 20 || nearestExisting.distanceM < 25)) continue;
                injected.push({
                    type: 'div',
                    label: 'Netz-Knoten',
                    lat: node.lat,
                    lng: node.lng,
                    trackIndex: nearTrack.index,
                    score: 950 + node.degree,
                    msg: 'Netz-Knoten | Track-Index ' + nearTrack.index
                });
            }
            return injected;
        }

}

        function findNearestGraphNodeCandidates(graph, point, trackPoints, centerTrackIndex, preferred, maxDist, maxCount) {
            const out = [];
            const minIndex = Math.max(0, (centerTrackIndex || 0) - 60);
            const maxIndex = Math.min(trackPoints.length - 1, (centerTrackIndex || 0) + 60);
            for (let i = 0; i < graph.nodeList.length; i++) {
                const node = graph.nodeList[i];
                const dist = getDist(point.lat, point.lng, node.lat, node.lng);
                if (dist > maxDist) continue;
                const nearTrack = nearestTrackIndexToLatLng(trackPoints, node.lat, node.lng, minIndex, maxIndex);
                if (!nearTrack || nearTrack.distanceM > 25) continue;
                const degreePenalty = preferred === 'junction' && node.degree < 3 ? 18 : 0;
                const score = dist + nearTrack.distanceM * 1.5 + degreePenalty;
                out.push({ node: node, distanceM: dist, score: score, trackIndex: nearTrack.index });
            }
            out.sort(function (a, b) { return a.score - b.score; });
            return out.slice(0, maxCount || 5);
        }

}

        function findBestGraphPath(graph, startCandidates, endCandidates, trackSeg) {
            let best = null;
            for (let i = 0; i < startCandidates.length; i++) {
                for (let j = 0; j < endCandidates.length; j++) {
                    const startCand = startCandidates[i];
                    const endCand = endCandidates[j];
                    if (startCand.node.id === endCand.node.id) continue;
                    const path = shortestPathOnGraph(graph, startCand.node.id, endCand.node.id, trackSeg);
                    if (!path) continue;
                    const totalScore = path.cost + startCand.distanceM * 3 + endCand.distanceM * 3;
                    if (!best || totalScore < best.totalScore) {
                        best = Object.assign({ totalScore: totalScore }, path);
                    }
                }
            }
            return best;
        }

}

        function shortestPathOnGraph(graph, startId, endId, trackSeg) {
            const queue = [{ id: startId, cost: 0 }];
            const bestCost = new Map([[startId, 0]]);
            const prev = new Map();
            const prevEdge = new Map();
            const trackCoords = trackSeg.map(function (p) { return { lat: p.lat, lng: p.lng }; });
            let guard = 0;

            while (queue.length) {
                queue.sort(function (a, b) { return a.cost - b.cost; });
                const current = queue.shift();
                if (current.cost !== bestCost.get(current.id)) continue;
                if (current.id === endId) break;
                if (++guard > 250000) break;
                const edges = graph.edgesByNode.get(current.id) || [];
                for (let i = 0; i < edges.length; i++) {
                    const edge = edges[i];
                    const stepCost = computeGraphEdgeCost(edge, trackCoords);
                    const nextCost = current.cost + stepCost;
                    if (!bestCost.has(edge.to) || nextCost < bestCost.get(edge.to)) {
                        bestCost.set(edge.to, nextCost);
                        prev.set(edge.to, current.id);
                        prevEdge.set(edge.to, edge);
                        queue.push({ id: edge.to, cost: nextCost });
                    }
                }
            }

            if (!bestCost.has(endId)) return null;
            return reconstructGraphPath(graph, startId, endId, prev, prevEdge, bestCost.get(endId));
        }

}

        function computeGraphEdgeCost(edge, trackCoords) {
            const trackPenalty = Math.min(90, nearestDistanceToPolyline(edge.midpoint, trackCoords));
            return edge.distM * edge.preference + trackPenalty * 2.4;
        }

}

        function reconstructGraphPath(graph, startId, endId, prev, prevEdge, totalCost) {
            const nodeIds = [endId];
            const edgeList = [];
            let cur = endId;
            while (cur !== startId) {
                const edge = prevEdge.get(cur);
                const p = prev.get(cur);
                if (!edge || !p) return null;
                edgeList.push(edge);
                cur = p;
                nodeIds.push(cur);
            }
            nodeIds.reverse();
            edgeList.reverse();
            const coords = [];
            for (let i = 0; i < nodeIds.length; i++) {
                const node = graph.nodes.get(nodeIds[i]);
                coords.push({ lat: node.lat, lng: node.lng });
            }
            const wayCounts = new Map();
            let distanceM = 0;
            for (let i = 0; i < edgeList.length; i++) {
                distanceM += edgeList[i].distM;
                const wayId = edgeList[i].wayId || 'unknown';
                wayCounts.set(wayId, (wayCounts.get(wayId) || 0) + edgeList[i].distM);
            }
            let primaryWayId = null;
            let bestLen = -1;
            wayCounts.forEach(function (len, wayId) {
                if (len > bestLen && wayId !== 'unknown') {
                    bestLen = len;
                    primaryWayId = wayId;
                }
            });
            return {
                coords: coords,
                distanceM: distanceM,
                cost: totalCost,
                primaryWayId: primaryWayId
            };
        }
