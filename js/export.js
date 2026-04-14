'use strict';

window.TAP = window.TAP || {};
var TAP = window.TAP;
var state = TAP.state;
var els = TAP.els;


}

        function downloadTextFile(filename, content, mimeType) {
            const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

}

        function downloadJsonFile(filename, obj, mimeType) {
            downloadTextFile(filename, JSON.stringify(obj, null, 2), mimeType || 'application/json;charset=utf-8');
        }

}

        function buildExportGeoJSON(author, analysis) {
            state.exportGeoJSON = {
                type: 'FeatureCollection',
                features: []
            };
            state.exportGeoJSON.features.push({
                type: 'Feature',
                properties: {
                    type: 'recorded_track',
                    author: author,
                    distance_km: round(analysis.allDistance / 1000, 3)
                },
                geometry: {
                    type: 'LineString',
                    coordinates: state.trackPoints.map(function (p) { return [p.lng, p.lat, p.ele]; })
                }
            });
            appendPolylineFeatures('outbound_unique', analysis.outboundPolylines, '#2563eb');
            appendPolylineFeatures('return_unique', analysis.returnPolylines, '#dc2626');
            appendPolylineFeatures('common_overlap', analysis.commonPolylines, '#facc15');
            rebuildDynamicExportFeatures();
        }

}

        function rebuildDynamicExportFeatures() {
            if (!state.exportGeoJSON) return;
            state.exportGeoJSON.features = state.exportGeoJSON.features.filter(function (f) {
                return !['selected_segment', 'osm_bicycle_route', 'auto_point', 'auto_route_piece', 'final_route'].includes(f.properties.type);
            });

            for (let i = 0; i < state.autoPoints.length; i++) {
                const pt = state.autoPoints[i];
                state.exportGeoJSON.features.push({
                    type: 'Feature',
                    properties: {
                        type: 'auto_point',
                        point_type: pt.type,
                        label: pt.label,
                        track_index: pt.trackIndex
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [pt.lng, pt.lat]
                    }
                });
            }

            for (let i = 0; i < state.osmWays.length; i++) {
                const way = state.osmWays[i];
                state.exportGeoJSON.features.push({
                    type: 'Feature',
                    properties: {
                        type: 'osm_bicycle_route',
                        osm_way_id: way.id || null
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: way.geometry.map(function (pt) { return [pt.lon, pt.lat]; })
                    }
                });
            }

            for (let i = 0; i < state.autoRoutePieces.length; i++) {
                const piece = state.autoRoutePieces[i];
                state.exportGeoJSON.features.push({
                    type: 'Feature',
                    properties: {
                        type: 'auto_route_piece',
                        piece_no: piece.pieceNo,
                        source: piece.source,
                        osm_way_id: piece.wayId,
                        distance_km: round(piece.distanceM / 1000, 3),
                        from_track_index: piece.fromTrackIndex,
                        to_track_index: piece.toTrackIndex
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: piece.coords.map(function (c) { return [c[1], c[0]]; })
                    }
                });
            }

            const finalRouteFeature = createFinalRouteFeature();
            if (finalRouteFeature) {
                state.exportGeoJSON.features.push(finalRouteFeature);
            }

            if (state.overlay.selected && state.markers.A && state.markers.B && state.selectedSegmentResult && state.selectedSegmentResult.coords && state.selectedSegmentResult.coords.length >= 2) {
                state.exportGeoJSON.features.push({
                    type: 'Feature',
                    properties: {
                        type: 'selected_segment',
                        source: state.selectedSegmentResult.source || 'track',
                        osm_way_id: state.selectedSegmentResult.wayId || null,
                        distance_km: round((state.selectedSegmentResult.distanceM || 0) / 1000, 3),
                        from_track_index: state.selectedSegmentResult.fromTrackIndex,
                        to_track_index: state.selectedSegmentResult.toTrackIndex
                    },
                    geometry: {
                        type: 'LineString',
                        coordinates: state.selectedSegmentResult.coords.map(function (p) { return [p[1], p[0]]; })
                    }
                });
            }
        }

}

        function synthesizeFinalRouteCoords() {
            if (!state.autoRoutePieces || !state.autoRoutePieces.length) return [];
            const sortedPieces = state.autoRoutePieces.slice().sort(function (a, b) {
                return (a.pieceNo || 0) - (b.pieceNo || 0);
            });
            const coords = [];
            let prevPiece = null;

            for (let i = 0; i < sortedPieces.length; i++) {
                const piece = sortedPieces[i];
                if (!piece || !piece.coords || piece.coords.length < 2) continue;
                let lngLatCoords = piece.coords.map(function (c) { return [c[1], c[0]]; });

                if (coords.length) {
                    const last = coords[coords.length - 1];
                    const distToFirst = getDist(last[1], last[0], lngLatCoords[0][1], lngLatCoords[0][0]);
                    const distToLast = getDist(last[1], last[0], lngLatCoords[lngLatCoords.length - 1][1], lngLatCoords[lngLatCoords.length - 1][0]);
                    if (distToLast + 3 < distToFirst) lngLatCoords.reverse();

                    if (prevPiece && Number.isInteger(prevPiece.toTrackIndex) && Number.isInteger(piece.fromTrackIndex)) {
                        const bridge = synthesizeTrackBridgeCoords(prevPiece.toTrackIndex, piece.fromTrackIndex);
                        if (bridge.length >= 2) {
                            appendCoordsDedup(coords, bridge, 20);
                        }
                    }
                }

                appendCoordsDedup(coords, lngLatCoords, 20);
                prevPiece = piece;
            }
            return coords;
        }

}

        function synthesizeTrackBridgeCoords(fromTrackIndex, toTrackIndex) {
            if (!state.trackPoints || !state.trackPoints.length) return [];
            if (!Number.isInteger(fromTrackIndex) || !Number.isInteger(toTrackIndex)) return [];
            const diff = Math.abs(toTrackIndex - fromTrackIndex);
            if (diff <= 1 || diff > 60) return [];
            const forward = fromTrackIndex <= toTrackIndex;
            const slice = state.trackPoints.slice(Math.min(fromTrackIndex, toTrackIndex), Math.max(fromTrackIndex, toTrackIndex) + 1);
            const ordered = forward ? slice : slice.slice().reverse();
            if (ordered.length < 2) return [];
            return ordered.map(function (p) { return [p.lng, p.lat]; });
        }

}

        function appendCoordsDedup(target, source, joinThresholdM) {
            const threshold = Number.isFinite(joinThresholdM) ? joinThresholdM : 20;
            for (let i = 0; i < source.length; i++) {
                const next = source[i];
                if (!target.length) {
                    target.push(next);
                    continue;
                }
                const prev = target[target.length - 1];
                const dist = getDist(prev[1], prev[0], next[1], next[0]);
                if (i === 0 && dist <= threshold) continue;
                target.push(next);
            }
        }

}

        function createFinalRouteFeature() {
            const coords = synthesizeFinalRouteCoords();
            if (coords.length < 2) return null;
            return {
                type: 'Feature',
                properties: {
                    type: 'final_route',
                    source: 'auto_route_pieces',
                    piece_count: state.autoRoutePieces.length,
                    distance_km: round(calcLineDistanceFromLngLat(coords) / 1000, 3)
                },
                geometry: {
                    type: 'LineString',
                    coordinates: coords
                }
            };
        }

}

        function calcLineDistanceFromLngLat(coords) {
            let meters = 0;
            for (let i = 1; i < coords.length; i++) {
                meters += getDist(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
            }
            return meters;
        }

}

        function buildFinalRouteGpx(coords) {
            const lines = [];
            lines.push('<?xml version="1.0" encoding="UTF-8"?>');
            lines.push('<gpx version="1.1" creator="Tour Analyzer Pro v18c - Lutz Müller (gabischatz)" xmlns="http://www.topografix.com/GPX/1/1">');
            lines.push('  <trk>');
            lines.push('    <name>Final Route</name>');
            lines.push('    <trkseg>');
            for (let i = 0; i < coords.length; i++) {
                const c = coords[i];
                lines.push('      <trkpt lat="' + c[1] + '" lon="' + c[0] + '"></trkpt>');
            }
            lines.push('    </trkseg>');
            lines.push('  </trk>');
            lines.push('</gpx>');
            return lines.join('\n');
        }

}

        function appendPolylineFeatures(type, polylines, color) {
            for (let i = 0; i < polylines.length; i++) {
                const line = polylines[i];
                if (!line || line.length < 2) continue;
                state.exportGeoJSON.features.push({
                    type: 'Feature',
                    properties: { type: type, color: color },
                    geometry: {
                        type: 'LineString',
                        coordinates: line.map(function (c) { return [c[1], c[0]]; })
                    }
                });
            }
        }

}


        function makeFeatureCollection(features) {
            return {
                type: 'FeatureCollection',
                features: features || []
            };
        }

}

        function exportPiecesGeoJSONFile() {
            if (!state.exportGeoJSON) return setStatus('Es gibt noch keine Teilstücke zum Exportieren.', 'error');
            const features = state.exportGeoJSON.features.filter(function (f) { return f.properties && f.properties.type === 'auto_route_piece'; });
            if (!features.length) return setStatus('Keine automatischen Teilstücke vorhanden.', 'error');
            downloadJsonFile('tour-analyzer-pro-v17-route-pieces.geojson', makeFeatureCollection(features), 'application/geo+json;charset=utf-8');
            setStatus('Teilstücke exportiert.', 'success');
        }

}

        function exportOsmGeoJSONFile() {
            if (!state.exportGeoJSON) return setStatus('Es gibt noch keine OSM-Wege zum Exportieren.', 'error');
            const features = state.exportGeoJSON.features.filter(function (f) { return f.properties && f.properties.type === 'osm_bicycle_route'; });
            if (!features.length) return setStatus('Keine OSM-Wege vorhanden.', 'error');
            downloadJsonFile('tour-analyzer-pro-v17-osm-ways.geojson', makeFeatureCollection(features), 'application/geo+json;charset=utf-8');
            setStatus('OSM-Wege exportiert.', 'success');
        }

}

        function exportAutoPointsGeoJSONFile() {
            if (!state.exportGeoJSON) return setStatus('Es gibt noch keine Auto-Punkte zum Exportieren.', 'error');
            const features = state.exportGeoJSON.features.filter(function (f) { return f.properties && f.properties.type === 'auto_point'; });
            if (!features.length) return setStatus('Keine Auto-Punkte vorhanden.', 'error');
            downloadJsonFile('tour-analyzer-pro-v17-auto-points.geojson', makeFeatureCollection(features), 'application/geo+json;charset=utf-8');
            setStatus('Auto-Punkte exportiert.', 'success');
        }

}

        function exportFinalRouteGeoJSONFile() {
            const feature = createFinalRouteFeature();
            if (!feature) return setStatus('Es gibt noch keine Final Route zum Exportieren.', 'error');
            downloadJsonFile('tour-analyzer-pro-v18c-final-route.geojson', makeFeatureCollection([feature]), 'application/geo+json;charset=utf-8');
            setStatus('Final-Route-GeoJSON exportiert.', 'success');
        }

}

        function exportFinalRouteGpxFile() {
            const coords = synthesizeFinalRouteCoords();
            if (coords.length < 2) return setStatus('Es gibt noch keine Final Route als GPX.', 'error');
            const blob = new Blob(['﻿', buildFinalRouteGpx(coords)], {
                type: 'application/gpx+xml;charset=utf-8'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tour-analyzer-pro-v18c-final-route.gpx';
            a.click();
            URL.revokeObjectURL(url);
            setStatus('Final-Route-GPX exportiert.', 'success');
        }

}

        function exportRawOverpassFile() {
            if (!state.debug.lastOverpassData) return setStatus('Es gibt noch keine Overpass-Rohantwort.', 'error');
            downloadJsonFile('tour-analyzer-pro-v17-overpass-raw.json', state.debug.lastOverpassData, 'application/json;charset=utf-8');
            setStatus('Overpass-Rohantwort exportiert.', 'success');
        }

}

        function exportDebugBundleFile() {
            const bundle = {
                meta: {
                    version: 'v17',
                    author: state.currentAuthor || 'Lutz Müller (gabischatz)',
                    createdAt: new Date().toISOString()
                },
                bbox: state.bbox,
                debug: state.debug,
                stats: {
                    rawPoints: state.rawPoints.length,
                    trackPoints: state.trackPoints.length,
                    osmWays: state.osmWays.length,
                    autoPoints: state.autoPoints.length,
                    autoRoutePieces: state.autoRoutePieces.length
                },
                autoPoints: state.autoPoints,
                autoRoutePieces: state.autoRoutePieces
            };
            downloadJsonFile('tour-analyzer-pro-v17-debug-bundle.json', bundle, 'application/json;charset=utf-8');
            setStatus('Debug-Bundle exportiert.', 'success');
        }

}

        function exportGeoJSONFile() {
            if (!state.exportGeoJSON) {
                setStatus('Es gibt noch nichts zu exportieren.', 'error');
                return;
            }
            const blob = new Blob(['\ufeff', JSON.stringify(state.exportGeoJSON, null, 2)], {
                type: 'application/geo+json;charset=utf-8'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tour-analyzer-pro-v17-breakpoints.geojson';
            a.click();
            URL.revokeObjectURL(url);
            setStatus('GeoJSON exportiert.', 'success');
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
