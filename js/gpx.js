'use strict';

window.TAP = window.TAP || {};
var TAP = window.TAP;
var state = TAP.state;
var els = TAP.els;


}

        function onFileSelected(ev) {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            logEvent('GPX-Datei ausgewählt: ' + file.name + ' (' + file.size + ' Bytes)');
            state.debug.counters.selectedFileBytes = file.size;
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    await debugBreakpoint('fileSelected', 'GPX-Datei ausgewählt', {
                        datei: file.name,
                        bytes: file.size
                    });
                    const xmlText = e.target.result;
                    const gpxDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
                    const authorNode = gpxDoc.querySelector('metadata author name');
                    const author = authorNode && authorNode.textContent ? authorNode.textContent.trim() : 'Lutz Müller (gabischatz)';
                    els.metaDisplay.textContent = author;
                    const geojson = toGeoJSON.gpx(gpxDoc);
                    const rawPoints = extractRawPoints(geojson);
                    if (rawPoints.length < 2) throw new Error('Die GPX-Datei enthält zu wenige Trackpunkte.');
                    await debugBreakpoint('gpxParsed', 'GPX geparst', {
                        author: author,
                        features: geojson && geojson.features ? geojson.features.length : 0,
                        rawPoints: rawPoints.length
                    });
                    await processTrack(rawPoints, author);
                } catch (err) {
                    console.error(err);
                    setStatus('Fehler beim Verarbeiten der GPX-Datei: ' + err.message, 'error');
                }
            };
            reader.readAsText(file, 'UTF-8');
        }

}

        function extractRawPoints(geojson) {
            const points = [];
            const features = geojson && geojson.features ? geojson.features : [];
            for (let i = 0; i < features.length; i++) {
                const feature = features[i];
                if (!feature.geometry || feature.geometry.type !== 'LineString') continue;
                const coords = feature.geometry.coordinates || [];
                const times = feature.properties && (feature.properties.coordTimes || feature.properties.times)
                    ? (feature.properties.coordTimes || feature.properties.times)
                    : [];
                for (let j = 0; j < coords.length; j++) {
                    const c = coords[j];
                    const t = times[j] ? new Date(times[j]) : null;
                    points.push({
                        lat: Number(c[1]),
                        lng: Number(c[0]),
                        ele: Number.isFinite(Number(c[2])) ? Number(c[2]) : 0,
                        time: t instanceof Date && !isNaN(t.getTime()) ? t : null
                    });
                }
            }
            return points;
        }

}

        async function processTrack(rawPoints, author) {
            const tProcessTrack = performance.now();
            resetMapLayersOnly();
            clearAllMarkers();
            state.rawPoints = rawPoints.slice();
            state.currentAuthor = author || '';
            await debugBreakpoint('trackSimplified', 'GPX vereinfachen', {
                rawPoints: rawPoints.length,
                minDistMeters: 7
            });
            state.trackPoints = simplifyTrack(rawPoints, 7);
            logEvent('GPX verarbeitet: ' + rawPoints.length + ' Rohpunkte, ' + state.trackPoints.length + ' vereinfachte Punkte.');
            if (state.trackPoints.length < 2) throw new Error('Nach der Vereinfachung blieben zu wenige Punkte übrig.');

            state.bbox = computeBounds(state.trackPoints, 0.0035);
            state.analysis = analyzeOutAndBack(state.trackPoints);
            await debugBreakpoint('trackAnalyzed', 'Bereich / Analyse fertig', {
                simplifiedPoints: state.trackPoints.length,
                bbox: state.bbox,
                totalDistanceKm: round(state.analysis.allDistance / 1000, 3)
            });
            state.autoPoints = [];

            drawTrackAnalysis(state.analysis);
            placeTrackMarkers(state.analysis);
            buildExportGeoJSON(author, state.analysis);
            setTiming('GPX-Verarbeitung', round(performance.now() - tProcessTrack, 1) + ' ms');

            els.reloadOsmBtn.disabled = false;
            els.extractBtn.disabled = false;
            setExportButtonsEnabled(true);
            els.pointA.value = '';
            els.pointB.value = '';
            state.selectedSegmentResult = null;
            state.selectedSegmentResult = null;
            clearMarker('A');
            clearMarker('B');

            setStatus('GPX geladen. Bereich bestimmt. OSM-Routen und Rad-Wege werden jetzt geladen …', 'success');
            await debugBreakpoint('osmLoadStart', 'OSM-Laden starten', {
                relationId: state.relationId || null,
                bbox: state.bbox,
                simplifiedPoints: state.trackPoints.length
            });
            await loadOsmRoutesForCurrentTrack();
        }

}

        function simplifyTrack(points, minDistMeters) {
            const out = [];
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
                if (!out.length) {
                    out.push(Object.assign({}, p, { stepDistM: 0, cumDistM: 0 }));
                    continue;
                }
                const prev = out[out.length - 1];
                const d = getDist(prev.lat, prev.lng, p.lat, p.lng);
                if (d >= minDistMeters || i === points.length - 1) {
                    out.push(Object.assign({}, p, { stepDistM: d, cumDistM: 0 }));
                }
            }
            let cum = 0;
            for (let i = 0; i < out.length; i++) {
                if (i === 0) {
                    out[i].stepDistM = 0;
                    out[i].cumDistM = 0;
                } else {
                    out[i].stepDistM = getDist(out[i - 1].lat, out[i - 1].lng, out[i].lat, out[i].lng);
                    cum += out[i].stepDistM;
                    out[i].cumDistM = cum;
                }
            }
            return out;
        }

}

        function analyzeOutAndBack(points) {
            const pivotIndex = findTurnaroundIndex(points);
            const outboundSegments = [];
            const returnSegments = [];

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const dist = getDist(p1.lat, p1.lng, p2.lat, p2.lng);
                if (dist < 1) continue;
                const seg = {
                    startIndex: i,
                    endIndex: i + 1,
                    coords: [[p1.lat, p1.lng], [p2.lat, p2.lng]],
                    distanceM: dist,
                    midpoint: midpointLatLng(p1.lat, p1.lng, p2.lat, p2.lng),
                    bearing: bearing(p1.lat, p1.lng, p2.lat, p2.lng),
                    matched: false
                };
                if (i < pivotIndex) outboundSegments.push(seg);
                else returnSegments.push(seg);
            }

            const commonOutbound = [];
            const uniqueOutbound = [];
            const commonReturn = [];
            const uniqueReturn = [];

            for (let o = 0; o < outboundSegments.length; o++) {
                const outSeg = outboundSegments[o];
                let foundMatch = false;
                for (let r = 0; r < returnSegments.length; r++) {
                    const retSeg = returnSegments[r];
                    if (retSeg.matched) continue;
                    if (segmentsLikelySamePath(outSeg, retSeg)) {
                        outSeg.matched = true;
                        retSeg.matched = true;
                        commonOutbound.push(outSeg);
                        commonReturn.push(retSeg);
                        foundMatch = true;
                        break;
                    }
                }
                if (!foundMatch) uniqueOutbound.push(outSeg);
            }

            for (let r = 0; r < returnSegments.length; r++) {
                if (!returnSegments[r].matched) uniqueReturn.push(returnSegments[r]);
            }

            return {
                pivotIndex: pivotIndex,
                pivotPoint: points[pivotIndex],
                outboundPolylines: mergeSegmentsToPolylines(uniqueOutbound),
                returnPolylines: mergeSegmentsToPolylines(uniqueReturn),
                commonPolylines: mergeSegmentsToPolylines(commonOutbound),
                allDistance: sumPointsDistance(points),
                outboundDistance: sumSegments(uniqueOutbound) + sumSegments(commonOutbound),
                returnDistance: sumSegments(uniqueReturn) + sumSegments(commonReturn),
                commonDistance: Math.min(sumSegments(commonOutbound), sumSegments(commonReturn))
            };
        }

}

        function findTurnaroundIndex(points) {
            const start = points[0];
            let maxDist = -1;
            let maxIdx = Math.max(1, Math.floor(points.length / 2));
            for (let i = 1; i < points.length; i++) {
                const d = getDist(start.lat, start.lng, points[i].lat, points[i].lng);
                if (d >= maxDist) {
                    maxDist = d;
                    maxIdx = i;
                }
            }
            return maxIdx;
        }

}

        function segmentsLikelySamePath(a, b) {
            const midDist = getDist(a.midpoint.lat, a.midpoint.lng, b.midpoint.lat, b.midpoint.lng);
            const lenDiff = Math.abs(a.distanceM - b.distanceM);
            const startToStart = getDist(a.coords[0][0], a.coords[0][1], b.coords[0][0], b.coords[0][1]);
            const startToEnd = getDist(a.coords[0][0], a.coords[0][1], b.coords[1][0], b.coords[1][1]);
            const endToStart = getDist(a.coords[1][0], a.coords[1][1], b.coords[0][0], b.coords[0][1]);
            const endToEnd = getDist(a.coords[1][0], a.coords[1][1], b.coords[1][0], b.coords[1][1]);
            const endpointMatchDirect = startToStart < 22 && endToEnd < 22;
            const endpointMatchReverse = startToEnd < 22 && endToStart < 22;
            return midDist < 18 && lenDiff < 28 && (endpointMatchDirect || endpointMatchReverse);
        }

}

        function mergeSegmentsToPolylines(segments) {
            if (!segments.length) return [];
            const lines = [];
            let current = [segments[0].coords[0], segments[0].coords[1]];
            for (let i = 1; i < segments.length; i++) {
                const prev = segments[i - 1];
                const seg = segments[i];
                const gapIndex = seg.startIndex - prev.endIndex;
                const prevEnd = prev.coords[1];
                const nextStart = seg.coords[0];
                const spatialGap = getDist(prevEnd[0], prevEnd[1], nextStart[0], nextStart[1]);
                if (gapIndex <= 2 || spatialGap <= 18) {
                    if (spatialGap > 1.5) current.push(nextStart);
                    current.push(seg.coords[1]);
                } else {
                    lines.push(current);
                    current = [seg.coords[0], seg.coords[1]];
                }
            }
            lines.push(current);
            return lines;
        }

}

        function detectAutoPoints(points) {
            if (!points || points.length < 3) return [];
            const turns = collectTrackTurnCandidates(points);
            const overlaps = collectSelfOverlapCandidates(points);
            return normalizeAutoPoints(turns.concat(overlaps), points);
        }

}

        function collectTrackTurnCandidates(points) {
            const found = [];
            for (let i = 1; i < points.length - 1; i++) {
                const prevIdx = seekIndexByDistance(points, i, -1, 18);
                const nextIdx = seekIndexByDistance(points, i, 1, 18);
                if (prevIdx < 0 || nextIdx < 0 || prevIdx >= i || nextIdx <= i) continue;

                const pPrev = points[prevIdx];
                const p = points[i];
                const pNext = points[nextIdx];
                const b1 = bearing(pPrev.lat, pPrev.lng, p.lat, p.lng);
                const b2 = bearing(p.lat, p.lng, pNext.lat, pNext.lng);
                let diff = Math.abs(b1 - b2);
                if (diff > 180) diff = 360 - diff;
                if (diff < 24) continue;

                const deviation = distancePointToSegmentMeters(p, pPrev, pNext);
                const inDist = getDist(pPrev.lat, pPrev.lng, p.lat, p.lng);
                const outDist = getDist(p.lat, p.lng, pNext.lat, pNext.lng);
                const strongTurn = diff >= 34 && deviation >= 3.5;
                const clearCorner = diff >= 28 && deviation >= 6.5;
                if (!strongTurn && !clearCorner) continue;
                if (inDist < 6 || outDist < 6) continue;

                found.push({
                    type: 'turn',
                    label: 'Kurve',
                    lat: p.lat,
                    lng: p.lng,
                    trackIndex: i,
                    angle: Math.round(diff),
                    score: diff * 2 + deviation,
                    msg: 'Kurve ' + Math.round(diff) + '° | Track-Index ' + i
                });
            }
            return found;
        }

}

        function collectSelfOverlapCandidates(points) {
            const found = [];
            let isOverlapping = false;
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                let snappedIndex = -1;
                let snappedDist = Infinity;

                if (i > 55) {
                    for (let j = 0; j < i - 35; j++) {
                        const d = getDist(p.lat, p.lng, points[j].lat, points[j].lng);
                        if (d < 14 && d < snappedDist) {
                            snappedIndex = j;
                            snappedDist = d;
                        }
                    }
                }

                if (snappedIndex !== -1 && !isOverlapping) {
                    const match = points[snappedIndex];
                    found.push({
                        type: 'div',
                        label: 'Zusammenführung',
                        lat: (p.lat + match.lat) / 2,
                        lng: (p.lng + match.lng) / 2,
                        trackIndex: i,
                        matchIndex: snappedIndex,
                        score: 1000 - snappedDist,
                        msg: 'Zusammenführung | Track-Index ' + i + ' | Rücksprung zu ' + snappedIndex
                    });
                    isOverlapping = true;
                } else if (snappedIndex === -1 && isOverlapping) {
                    found.push({
                        type: 'div',
                        label: 'Abzweigung',
                        lat: p.lat,
                        lng: p.lng,
                        trackIndex: i,
                        matchIndex: null,
                        score: 800,
                        msg: 'Abzweigung | Track-Index ' + i
                    });
                    isOverlapping = false;
                }
            }
            return found;
        }

}

        function normalizeAutoPoints(found, points) {
            found.sort(function (a, b) {
                if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
                return (b.score || 0) - (a.score || 0);
            });

            const deduped = [];
            for (let i = 0; i < found.length; i++) {
                const pt = found[i];
                const prev = deduped[deduped.length - 1];
                if (!prev) {
                    deduped.push(pt);
                    continue;
                }
                const idxGap = pt.trackIndex - prev.trackIndex;
                const distGap = getDist(pt.lat, pt.lng, prev.lat, prev.lng);
                if (idxGap < 10 || distGap < 20) {
                    const prevScore = (prev.score || 0) + (prev.type === 'div' ? 1000 : 0);
                    const curScore = (pt.score || 0) + (pt.type === 'div' ? 1000 : 0);
                    if (curScore > prevScore) deduped[deduped.length - 1] = pt;
                    continue;
                }
                deduped.push(pt);
            }

            const cleaned = [];
            const minDistFromEnds = 12;
            for (let i = 0; i < deduped.length; i++) {
                const pt = deduped[i];
                if (pt.trackIndex <= 0 || pt.trackIndex >= points.length - 1) continue;
                if (points[pt.trackIndex].cumDistM < minDistFromEnds) continue;
                if (points[points.length - 1].cumDistM - points[pt.trackIndex].cumDistM < minDistFromEnds) continue;
                cleaned.push(pt);
            }
            return cleaned;
        }

}

        function refineAutoPointsWithOsm(trackPoints, autoPoints, osmWays) {
            if (!trackPoints.length || !autoPoints.length || !osmWays.length) return autoPoints.slice();
            const candidates = buildOsmAnchorCandidates(osmWays);
            if (!candidates.length) return autoPoints.slice();

            const refined = [];
            for (let i = 0; i < autoPoints.length; i++) {
                const pt = Object.assign({}, autoPoints[i]);
                const snapped = findBestOsmCandidateForAutoPoint(pt, trackPoints, candidates);
                if (snapped) {
                    pt.lat = snapped.lat;
                    pt.lng = snapped.lng;
                    pt.trackIndex = snapped.trackIndex;
                    pt.osmKind = snapped.kind;
                    pt.msg += ' | OSM-Snap ' + snapped.kind + ' (' + Math.round(snapped.distanceM) + ' m)';
                }
                refined.push(pt);
            }

            const injected = injectMissingOsmAnchors(trackPoints, refined, candidates);
            return normalizeAutoPoints(refined.concat(injected), trackPoints);
        }

}

        function buildOsmAnchorCandidates(osmWays) {
            const grouped = new Map();
            const candidates = [];

            function addGroupedCandidate(lat, lng, wayId, role) {
                const key = lat.toFixed(5) + ',' + lng.toFixed(5);
                if (!grouped.has(key)) grouped.set(key, { lat: lat, lng: lng, wayIds: new Set(), roles: new Map(), count: 0 });
                const g = grouped.get(key);
                g.wayIds.add(wayId);
                g.roles.set(role, (g.roles.get(role) || 0) + 1);
                g.count++;
            }

            for (let i = 0; i < osmWays.length; i++) {
                const way = osmWays[i];
                const geom = way.geometry || [];
                if (geom.length < 2) continue;
                addGroupedCandidate(geom[0].lat, geom[0].lon, way.id || ('w' + i), 'endpoint');
                addGroupedCandidate(geom[geom.length - 1].lat, geom[geom.length - 1].lon, way.id || ('w' + i), 'endpoint');

                for (let j = 1; j < geom.length - 1; j++) {
                    const prev = geom[j - 1];
                    const cur = geom[j];
                    const next = geom[j + 1];
                    const b1 = bearing(prev.lat, prev.lon, cur.lat, cur.lon);
                    const b2 = bearing(cur.lat, cur.lon, next.lat, next.lon);
                    let diff = Math.abs(b1 - b2);
                    if (diff > 180) diff = 360 - diff;
                    if (diff >= 26) {
                        candidates.push({
                            kind: 'corner',
                            lat: cur.lat,
                            lng: cur.lon,
                            score: diff,
                            wayId: way.id || null
                        });
                    }
                }
            }

            grouped.forEach(function (g) {
                if (g.wayIds.size >= 2 || g.count >= 3) {
                    candidates.push({
                        kind: 'junction',
                        lat: g.lat,
                        lng: g.lng,
                        score: g.wayIds.size * 100 + g.count
                    });
                }
            });

            return dedupeOsmCandidates(candidates);
        }

const candidates = [];

            function addGroupedCandidate(lat, lng, wayId, role) {
                const key = lat.toFixed(5) + ',' + lng.toFixed(5);
                if (!grouped.has(key)) grouped.set(key, { lat: lat, lng: lng, wayIds: new Set(), roles: new Map(), count: 0 });
                const g = grouped.get(key);
                g.wayIds.add(wayId);
                g.roles.set(role, (g.roles.get(role) || 0) + 1);
                g.count++;
            }

}

        function dedupeOsmCandidates(candidates) {
            candidates.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
            const out = [];
            for (let i = 0; i < candidates.length; i++) {
                const cand = candidates[i];
                let keep = true;
                for (let j = 0; j < out.length; j++) {
                    if (getDist(cand.lat, cand.lng, out[j].lat, out[j].lng) < 14) {
                        keep = false;
                        break;
                    }
                }
                if (keep) out.push(cand);
            }
            return out;
        }

}

        function findBestOsmCandidateForAutoPoint(pt, trackPoints, candidates) {
            const preferredKind = pt.type === 'div' ? 'junction' : 'corner';
            let best = null;
            for (let i = 0; i < candidates.length; i++) {
                const cand = candidates[i];
                const pointDist = getDist(pt.lat, pt.lng, cand.lat, cand.lng);
                if (pointDist > 45) continue;
                const localTrack = nearestTrackIndexToLatLng(trackPoints, cand.lat, cand.lng, pt.trackIndex - 50, pt.trackIndex + 50);
                if (!localTrack || localTrack.distanceM > 24) continue;
                const kindPenalty = cand.kind === preferredKind ? 0 : 10;
                const score = pointDist + localTrack.distanceM * 1.5 + kindPenalty;
                if (!best || score < best.score) {
                    best = {
                        score: score,
                        lat: cand.lat,
                        lng: cand.lng,
                        trackIndex: localTrack.index,
                        kind: cand.kind,
                        distanceM: pointDist
                    };
                }
            }
            return best;
        }

}

        function injectMissingOsmAnchors(trackPoints, existingPoints, candidates) {
            const injected = [];
            const lastTrackIndex = trackPoints.length - 1;
            for (let i = 0; i < candidates.length; i++) {
                const cand = candidates[i];
                if (cand.kind !== 'junction' && cand.kind !== 'corner') continue;
                const nearTrack = nearestTrackIndexToLatLng(trackPoints, cand.lat, cand.lng, 0, lastTrackIndex);
                if (!nearTrack || nearTrack.distanceM > 14) continue;
                if (nearTrack.index <= 0 || nearTrack.index >= lastTrackIndex) continue;

                const nearestExisting = nearestAutoPointToTrackIndex(existingPoints, nearTrack.index, trackPoints);
                if (nearestExisting && (Math.abs(nearestExisting.trackIndex - nearTrack.index) < 12 || nearestExisting.distanceM < 22)) continue;

                const angle = localTrackAngle(trackPoints, nearTrack.index, 18);
                if (cand.kind === 'corner' && angle < 28) continue;
                if (cand.kind === 'junction' && angle < 16) continue;

                injected.push({
                    type: cand.kind === 'junction' ? 'div' : 'turn',
                    label: cand.kind === 'junction' ? 'OSM-Knoten' : 'OSM-Kurve',
                    lat: cand.lat,
                    lng: cand.lng,
                    trackIndex: nearTrack.index,
                    score: (cand.score || 0) + angle,
                    msg: (cand.kind === 'junction' ? 'OSM-Knoten' : 'OSM-Kurve') + ' | Track-Index ' + nearTrack.index
                });
            }
            return injected;
        }

}

        function nearestAutoPointToTrackIndex(points, trackIndex, trackPoints) {
            let best = null;
            for (let i = 0; i < points.length; i++) {
                const pt = points[i];
                const idxGap = Math.abs(pt.trackIndex - trackIndex);
                const distM = getDist(pt.lat, pt.lng, trackPoints[trackIndex].lat, trackPoints[trackIndex].lng);
                if (!best || idxGap < best.idxGap || (idxGap === best.idxGap && distM < best.distanceM)) {
                    best = { point: pt, idxGap: idxGap, distanceM: distM, trackIndex: pt.trackIndex };
                }
            }
            return best;
        }

}

        function nearestTrackIndexToLatLng(trackPoints, lat, lng, minIndex, maxIndex) {
            if (!trackPoints.length) return null;
            const start = Math.max(0, Number.isFinite(minIndex) ? minIndex : 0);
            const end = Math.min(trackPoints.length - 1, Number.isFinite(maxIndex) ? maxIndex : (trackPoints.length - 1));
            let best = null;
            for (let i = start; i <= end; i++) {
                const d = getDist(lat, lng, trackPoints[i].lat, trackPoints[i].lng);
                if (!best || d < best.distanceM) best = { index: i, distanceM: d };
            }
            return best;
        }

}

        function localTrackAngle(points, index, distanceMeters) {
            if (index <= 0 || index >= points.length - 1) return 0;
            const prevIdx = seekIndexByDistance(points, index, -1, distanceMeters || 18);
            const nextIdx = seekIndexByDistance(points, index, 1, distanceMeters || 18);
            if (prevIdx < 0 || nextIdx < 0) return 0;
            const b1 = bearing(points[prevIdx].lat, points[prevIdx].lng, points[index].lat, points[index].lng);
            const b2 = bearing(points[index].lat, points[index].lng, points[nextIdx].lat, points[nextIdx].lng);
            let diff = Math.abs(b1 - b2);
            if (diff > 180) diff = 360 - diff;
            return diff;
        }

}

        function seekIndexByDistance(points, index, direction, distanceMeters) {
            const origin = points[index];
            let i = index + direction;
            while (i >= 0 && i < points.length) {
                const d = getDist(origin.lat, origin.lng, points[i].lat, points[i].lng);
                if (d >= distanceMeters) return i;
                i += direction;
            }
            return -1;
        }

}

        function distancePointToSegmentMeters(p, a, b) {
            const latScale = 111320;
            const lngScale = Math.cos(((a.lat + b.lat + p.lat) / 3) * Math.PI / 180) * 111320;
            const ax = a.lng * lngScale;
            const ay = a.lat * latScale;
            const bx = b.lng * lngScale;
            const by = b.lat * latScale;
            const px = p.lng * lngScale;
            const py = p.lat * latScale;
            const dx = bx - ax;
            const dy = by - ay;
            if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
            const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
            const qx = ax + t * dx;
            const qy = ay + t * dy;
            return Math.hypot(px - qx, py - qy);
        }

}

        function distancePointToSegmentMeters(p, a, b) {
            const refLat = p.lat * Math.PI / 180;
            const meterX = 111320 * Math.cos(refLat);
            const meterY = 110540;
            const px = p.lng * meterX;
            const py = p.lat * meterY;
            const ax = a.lng * meterX;
            const ay = a.lat * meterY;
            const bx = b.lng * meterX;
            const by = b.lat * meterY;
            const dx = bx - ax;
            const dy = by - ay;
            if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
            let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
            t = Math.max(0, Math.min(1, t));
            const qx = ax + t * dx;
            const qy = ay + t * dy;
            return Math.hypot(px - qx, py - qy);
        }

}

        async function handleSegmentCalculationRequest() {
            if (!state.trackPoints.length) {
                setStatus('Es ist noch keine GPX-Strecke geladen.', 'error');
                return;
            }
            if (state.markers.A && state.markers.B) {
                extractManualSegmentBetweenPoints();
                return;
            }
            calculateAutomaticRoutePieces(true);
        }

}

        function extractManualSegmentBetweenPoints() {
            const idxA = state.markers.A ? state.markers.A.trackIndex : null;
            const idxB = state.markers.B ? state.markers.B.trackIndex : null;
            if (!Number.isInteger(idxA) || !Number.isInteger(idxB)) {
                calculateAutomaticRoutePieces(true);
                return;
            }
            const forward = idxA <= idxB;
            const lowIdx = Math.min(idxA, idxB);
            const highIdx = Math.max(idxA, idxB);
            const slice = state.trackPoints.slice(lowIdx, highIdx + 1);
            if (slice.length < 2) {
                setStatus('Der manuelle Teilabschnitt ist zu kurz.', 'error');
                return;
            }

            const trackSeg = forward ? slice : slice.slice().reverse();
            const pointA = state.trackPoints[idxA];
            const pointB = state.trackPoints[idxB];
            const anchorA = {
                type: 'manual',
                label: 'Punkt A',
                trackIndex: idxA,
                lat: pointA.lat,
                lng: pointA.lng
            };
            const anchorB = {
                type: 'manual',
                label: 'Punkt B',
                trackIndex: idxB,
                lat: pointB.lat,
                lng: pointB.lng
            };

            const piece = deriveRoutePieceFromTrackSegment(trackSeg, anchorA, anchorB, 1);
            state.selectedSegmentResult = {
                source: piece.source,
                wayId: piece.wayId || null,
                coords: piece.coords.slice(),
                distanceM: piece.distanceM,
                fromTrackIndex: idxA,
                toTrackIndex: idxB
            };

            clearOverlay('selected');
            state.overlay.selected = L.layerGroup().addTo(state.map);
            L.polyline(piece.coords, {
                color: '#111827', weight: 9, opacity: 0.35, lineCap: 'round', lineJoin: 'round'
            }).addTo(state.overlay.selected);
            L.polyline(piece.coords, {
                color: piece.source === 'graph' || piece.source === 'osm' ? '#ffffff' : '#ffffff',
                weight: 5,
                opacity: 0.92,
                dashArray: piece.source === 'track' ? '10,8' : null,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(state.overlay.selected);

            if ((piece.source === 'graph' || piece.source === 'osm') && piece.coords.length >= 2) {
                const step = Math.max(1, Math.floor(piece.coords.length / 24));
                for (let i = 0; i < piece.coords.length; i += step) {
                    const c = piece.coords[i];
                    L.circleMarker(c, {
                        radius: 3,
                        color: '#b45309',
                        fillColor: '#f59e0b',
                        fillOpacity: 0.9,
                        weight: 1
                    }).addTo(state.overlay.selected);
                }
                const lastCoord = piece.coords[piece.coords.length - 1];
                if (lastCoord) {
                    L.circleMarker(lastCoord, {
                        radius: 3,
                        color: '#b45309',
                        fillColor: '#f59e0b',
                        fillOpacity: 0.9,
                        weight: 1
                    }).addTo(state.overlay.selected);
                }
            }

            els.statSegment.textContent = formatKm(piece.distanceM) + ' manuell (' + (piece.source === 'graph' ? 'Netz' : (piece.source === 'osm' ? 'OSM-Way' : 'Track')) + ')';
            state.map.fitBounds(L.latLngBounds(piece.coords).pad(0.12));
            rebuildDynamicExportFeatures();
            setStatus('Manueller Teilabschnitt A→B berechnet: ' + (piece.source === 'graph' ? 'OSM-Netzpfad' : (piece.source === 'osm' ? 'einzelner OSM-Way' : 'GPX-Fallback')) + '.', 'success');
            syncVisibilityFromUi();
        }

}

        function calculateAutomaticRoutePieces(fromButton) {
            clearOverlay('autoRoutePieces');
            state.autoRoutePieces = [];

            const anchors = buildAutomaticAnchors();
            logEvent('Automatische Anker: ' + anchors.length);
            if (anchors.length < 2) {
                els.statSegment.textContent = state.autoPoints.length + ' Punkte';
                rebuildDynamicExportFeatures();
                setStatus('Es wurden nicht genug automatische Punkte für Teilstücke gefunden.', 'error');
                return;
            }

            state.overlay.autoRoutePieces = L.layerGroup().addTo(state.map);
            let pieceNo = 1;
            for (let i = 0; i < anchors.length - 1; i++) {
                const a = anchors[i];
                const b = anchors[i + 1];
                if (b.trackIndex - a.trackIndex < 1) continue;
                const trackSeg = state.trackPoints.slice(a.trackIndex, b.trackIndex + 1);
                if (trackSeg.length < 2) continue;
                const piece = deriveRoutePieceFromTrackSegment(trackSeg, a, b, pieceNo);
                state.autoRoutePieces.push(piece);
                drawSinglePiece(piece);
                pieceNo++;
            }

            els.statSegment.textContent = state.autoPoints.length + ' Punkte / ' + state.autoRoutePieces.length + ' Stücke';
            rebuildDynamicExportFeatures();
            if (fromButton) {
                setStatus('Automatische Punkte verwendet. ' + state.autoRoutePieces.length + ' Teilstücke berechnet.', 'success');
            }
            syncVisibilityFromUi();
        }

}

        function buildAutomaticAnchors() {
            if (!state.trackPoints.length) return [];
            const anchors = [{
                type: 'start',
                label: 'Start',
                trackIndex: 0,
                lat: state.trackPoints[0].lat,
                lng: state.trackPoints[0].lng
            }];

            const lastTrackIndex = state.trackPoints.length - 1;
            const candidates = state.autoPoints.slice();
            if (state.analysis && Number.isInteger(state.analysis.pivotIndex) && state.analysis.pivotIndex > 0 && state.analysis.pivotIndex < lastTrackIndex) {
                const pivotPoint = state.trackPoints[state.analysis.pivotIndex];
                candidates.push({
                    type: 'pivot',
                    label: 'Wendepunkt',
                    trackIndex: state.analysis.pivotIndex,
                    lat: pivotPoint.lat,
                    lng: pivotPoint.lng,
                    score: 999999,
                    msg: 'Wendepunkt | Track-Index ' + state.analysis.pivotIndex
                });
            }

            candidates.sort(function (a, b) {
                if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
                if (a.type === 'pivot' && b.type !== 'pivot') return -1;
                if (b.type === 'pivot' && a.type !== 'pivot') return 1;
                return (b.score || 0) - (a.score || 0);
            });

            for (let i = 0; i < candidates.length; i++) {
                const pt = candidates[i];
                if (pt.trackIndex <= 0 || pt.trackIndex >= lastTrackIndex) continue;
                const prev = anchors[anchors.length - 1];
                const idxGap = pt.trackIndex - prev.trackIndex;
                const meterGap = state.trackPoints[pt.trackIndex].cumDistM - state.trackPoints[prev.trackIndex].cumDistM;
                const isMandatory = pt.type === 'pivot';

                if (idxGap < 1) {
                    if (isMandatory && prev.type !== 'start') anchors[anchors.length - 1] = pt;
                    continue;
                }

                if (!isMandatory && (idxGap < 4 || meterGap < 25)) continue;

                if (isMandatory && (idxGap < 8 || meterGap < 35) && prev.type !== 'start') {
                    anchors[anchors.length - 1] = pt;
                    continue;
                }

                anchors.push(pt);
            }

            if (state.analysis && Number.isInteger(state.analysis.pivotIndex) && !anchors.some(function (a) { return a.type === 'pivot'; })) {
                const pivotIdx = state.analysis.pivotIndex;
                const pivotPoint = state.trackPoints[pivotIdx];
                let insertPos = anchors.findIndex(function (a) { return a.trackIndex > pivotIdx; });
                if (insertPos < 0) insertPos = anchors.length;
                anchors.splice(insertPos, 0, {
                    type: 'pivot',
                    label: 'Wendepunkt',
                    trackIndex: pivotIdx,
                    lat: pivotPoint.lat,
                    lng: pivotPoint.lng,
                    score: 999999,
                    msg: 'Wendepunkt | Track-Index ' + pivotIdx
                });
            }

            const end = {
                type: 'end',
                label: 'Ende',
                trackIndex: lastTrackIndex,
                lat: state.trackPoints[lastTrackIndex].lat,
                lng: state.trackPoints[lastTrackIndex].lng
            };
            const prev = anchors[anchors.length - 1];
            if (end.trackIndex - prev.trackIndex >= 1) anchors.push(end);
            if (anchors.length === 1 && lastTrackIndex > 0) anchors.push(end);
            return anchors;
        }

}

        function deriveRoutePieceFromTrackSegment(trackSeg, anchorA, anchorB, pieceNo) {
            const trackDistance = sumPointsDistance(trackSeg);
            const startPoint = { lat: trackSeg[0].lat, lng: trackSeg[0].lng };
            const endPoint = { lat: trackSeg[trackSeg.length - 1].lat, lng: trackSeg[trackSeg.length - 1].lng };

            if (state.osmGraph && state.osmGraph.nodeList && state.osmGraph.nodeList.length) {
                let startCandidates = findNearestGraphNodeCandidates(state.osmGraph, startPoint, state.trackPoints, anchorA.trackIndex, anchorA.type === 'div' ? 'junction' : 'any', 36, 5);
                let endCandidates = findNearestGraphNodeCandidates(state.osmGraph, endPoint, state.trackPoints, anchorB.trackIndex, anchorB.type === 'div' ? 'junction' : 'any', 36, 5);
                if (!startCandidates.length) startCandidates = findNearestGraphNodeCandidates(state.osmGraph, startPoint, state.trackPoints, anchorA.trackIndex, 'any', 60, 6);
                if (!endCandidates.length) endCandidates = findNearestGraphNodeCandidates(state.osmGraph, endPoint, state.trackPoints, anchorB.trackIndex, 'any', 60, 6);
                const graphPath = findBestGraphPath(state.osmGraph, startCandidates, endCandidates, trackSeg);
                if (graphPath && graphPath.coords.length >= 2) {
                    return {
                        pieceNo: pieceNo,
                        source: 'graph',
                        wayId: graphPath.primaryWayId,
                        coords: graphPath.coords.map(function (p) { return [p.lat, p.lng]; }),
                        distanceM: graphPath.distanceM,
                        fromTrackIndex: anchorA.trackIndex,
                        toTrackIndex: anchorB.trackIndex,
                        fromLabel: anchorA.label,
                        toLabel: anchorB.label
                    };
                }
            }

            const samples = sampleTrackPoints(trackSeg, 10);
            let best = null;

            for (let i = 0; i < state.osmWays.length; i++) {
                const way = state.osmWays[i];
                const coords = way.geometry.map(function (pt) { return { lat: pt.lat, lng: pt.lon }; });
                if (coords.length < 2) continue;

                const startInfo = nearestVertexInfo(trackSeg[0], coords);
                const endInfo = nearestVertexInfo(trackSeg[trackSeg.length - 1], coords);
                const maxEndpointDist = Math.max(startInfo.distanceM, endInfo.distanceM);
                if (maxEndpointDist > 80) continue;

                const sliced = sliceCoordsBetweenIndices(coords, startInfo.index, endInfo.index);
                if (sliced.coords.length < 2) continue;

                let sumSampleDist = 0;
                for (let s = 0; s < samples.length; s++) {
                    sumSampleDist += nearestDistanceToPolyline(samples[s], sliced.coords);
                }
                const avgSampleDist = samples.length ? (sumSampleDist / samples.length) : 9999;
                const lenDiff = Math.abs(sliced.distanceM - trackDistance);
                const score = avgSampleDist * 2.5 + maxEndpointDist * 1.25 + lenDiff * 0.12;

                if (!best || score < best.score) {
                    best = {
                        score: score,
                        wayId: way.id || null,
                        coords: sliced.coords,
                        distanceM: sliced.distanceM,
                        avgSampleDist: avgSampleDist,
                        maxEndpointDist: maxEndpointDist
                    };
                }
            }

            if (best && best.score < 160) {
                return {
                    pieceNo: pieceNo,
                    source: 'osm',
                    wayId: best.wayId,
                    coords: best.coords.map(function (p) { return [p.lat, p.lng]; }),
                    distanceM: best.distanceM,
                    fromTrackIndex: anchorA.trackIndex,
                    toTrackIndex: anchorB.trackIndex,
                    fromLabel: anchorA.label,
                    toLabel: anchorB.label
                };
            }

            return {
                pieceNo: pieceNo,
                source: 'track',
                wayId: null,
                coords: trackSeg.map(function (p) { return [p.lat, p.lng]; }),
                distanceM: trackDistance,
                fromTrackIndex: anchorA.trackIndex,
                toTrackIndex: anchorB.trackIndex,
                fromLabel: anchorA.label,
                toLabel: anchorB.label
            };
        }

}

        function nearestVertexInfo(point, coords) {
            let bestIndex = 0;
            let bestDist = Infinity;
            for (let i = 0; i < coords.length; i++) {
                const d = getDist(point.lat, point.lng, coords[i].lat, coords[i].lng);
                if (d < bestDist) {
                    bestDist = d;
                    bestIndex = i;
                }
            }
            return { index: bestIndex, distanceM: bestDist };
        }

}

        function sliceCoordsBetweenIndices(coords, idxA, idxB) {
            let start = idxA;
            let end = idxB;
            if (start > end) {
                const tmp = start;
                start = end;
                end = tmp;
            }
            const sliced = coords.slice(start, end + 1);
            return { coords: sliced, distanceM: sumPointsDistance(sliced) };
        }

}

        function sampleTrackPoints(points, maxSamples) {
            if (points.length <= maxSamples) return points;
            const out = [];
            const step = (points.length - 1) / (maxSamples - 1);
            for (let i = 0; i < maxSamples; i++) {
                out.push(points[Math.round(i * step)]);
            }
            return out;
        }

}

        function nearestDistanceToPolyline(point, coords) {
            if (!coords.length) return Infinity;
            let best = Infinity;
            for (let i = 0; i < coords.length - 1; i++) {
                const d = distancePointToSegmentMeters(point, coords[i], coords[i + 1]);
                if (d < best) best = d;
            }
            return best;
        }
