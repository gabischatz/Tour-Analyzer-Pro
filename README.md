# Tour Analyzer Pro
**Live-App:**  
https://gabischatz.de.cool/tour-analyzer/index.html

## Projektstatus

Dieses Projekt funktioniert aktuell **noch nicht so, wie es gewünscht ist**.

Der derzeitige Stand ist ein technischer Zwischenschritt:
- GPX-Datei laden
- Bereich der Tour bestimmen
- OSM-/Overpass-Daten für diesen Bereich laden
- Rohdaten exportieren
- diese Rohdaten anschließend in einem separaten Schritt weiter aufbereiten

Die eigentliche fachliche Auswertung der geladenen OSM-Daten ist noch nicht fertig.

## Wichtiger aktueller Hintergrund

Beim Download der OSM-Daten kommt es immer wieder zu Problemen. Ein wesentlicher Grund dafür sind viele kleine Anfragen an die Overpass-/OSM-Datenbank. Deshalb wurde die Anfrage im Tour Analyzer Pro bewusst möglichst kompakt aufgebaut. Damit gab es bereits erste Erfolge beim Laden der Daten.

Das aktuelle Hauptproblem ist nicht mehr nur der Abruf, sondern vor allem die **Auswertung und Strukturierung** der vom Server gelieferten Daten.

Deshalb werden die geladenen Rohdaten in einem zweiten Schritt in ein objektorientiertes Modell überführt, um mehr Ordnung und nachvollziehbare Beziehungen in die OSM-Daten zu bekommen.

## Zusammenspiel mit dem OO-Konverter

Dieses Projekt dient im Moment hauptsächlich dazu, die OSM-Daten zu laden und als Rohdaten bereitzustellen.

Die weitere Aufbereitung erfolgt hier:

- https://github.com/gabischatz/Overpass-RAW--JSON-to-Objekt-JSON

Siehe dort auch die `README.md`.

## Hinweis zu OSM-/Overpass-Servern

OSM-/Overpass-Server verweigern zeitweise die Zusammenarbeit oder antworten gar nicht. In solchen Fällen wird versucht, automatisch auf einen anderen Server zu wechseln. Dieser Wechsel und die erneuten Versuche können mehrere Minuten in Anspruch nehmen.

## Unsicherheit bei der OSM-Abfrage

Aktuell ist noch nicht abschließend geklärt, ob die verwendete OSM-/Overpass-Abfrage fachlich bereits vollständig korrekt ist. Der technische Abruf funktioniert in Teilen besser als zuvor, die inhaltliche Bewertung und saubere Interpretation der Daten ist aber noch offen.

## Neue Projektstruktur

Die frühere Einzeldatei wurde für die Bearbeitung in mehrere Dateien aufgeteilt:

```text
Tour-Analyzer-Pro/
├─ index.html
├─ css/
│  └─ style.css
└─ js/
   ├─ app.js
   ├─ map.js
   ├─ overpass.js
   ├─ gpx.js
   ├─ export.js
   └─ debug.js
```

## Hinweis zur Aufteilung

Diese Aufteilung dient zuerst der besseren Wartbarkeit. Ziel war, die bestehende Datei sauber zu zerlegen, ohne die Grundlogik absichtlich umzubauen. Fachliche Fehler oder offene Probleme des Projekts sind damit nicht automatisch gelöst.

## Lizenz / Hinweise

Bitte bei Veröffentlichung noch ergänzen, welche Lizenz verwendet werden soll.
