# Tour Analyzer Pro

## Projektstatus

**Wichtiger Hinweis:** Dieses Projekt funktioniert aktuell **noch nicht so, wie es eigentlich vorgesehen ist**.

Der Name **Tour Analyzer Pro** klingt nach einer fertigen Anwendung zur vollständigen Analyse und automatischen Auswertung von Touren. Diesen Stand hat das Projekt zurzeit **noch nicht erreicht**.

## Wozu dieses Projekt im Moment dient

Der aktuelle Zweck dieses Repositoriums ist vor allem:

1. **GPX-Daten laden**
2. daraus eine **möglichst kompakte Overpass-Abfrage** für den passenden Bereich erzeugen
3. die **OSM-Rohdaten** von Overpass laden
4. diese Rohdaten als Datei exportieren
5. die exportierte Datei anschließend im Projekt **Overpass-RAW--JSON-to-Objekt-JSON** weiterverarbeiten

Das heißt:

**Tour Analyzer Pro ist im Moment vor allem ein Vorwerkzeug zum Laden und Exportieren von OSM-Daten.**

Die eigentliche strukturierte Aufbereitung der geladenen Overpass-Daten erfolgt anschließend hier:

- https://github.com/gabischatz/Overpass-RAW--JSON-to-Objekt-JSON

## Hintergrund der aktuellen Arbeitsweise

Bei den Downloads der OSM-Daten kommt es immer wieder zu Problemen. Ein wichtiger Grund dafür sind die vielen kleinen Anfragen an Overpass beziehungsweise an die OSM-Datenbank.

Deshalb wurde der Ansatz geändert:

- weg von vielen kleinen Einzelabfragen
- hin zu **möglichst kompakten, zusammengefassten Overpass-Abfragen**

Mit diesem kompakteren Ansatz gab es bereits Erfolge beim Laden der Daten.

## Das aktuelle Hauptproblem

Das größere Problem liegt zurzeit **nicht mehr nur im Download**, sondern vor allem in der **Auswertung und Weiterverarbeitung der gelieferten Daten**.

Die Overpass-Rohdaten sind zwar sehr wertvoll, aber in ihrer gelieferten Form für die gewünschte Weiterverarbeitung noch schwer nutzbar. Genau deshalb ist die Entscheidung gefallen, die Daten, die vom Server zurückkommen, in ein **objektorientiertes Modell** umzubauen.

Ziel davon ist es, mehr Struktur in die OSM-Rohdaten zu bringen, damit Wege, Straßen, Radrouten, Schutzstreifen und weitere Eigenschaften später besser ausgewertet und miteinander verknüpft werden können.

## Noch offene Unsicherheit

Aktuell ist außerdem **noch nicht abschließend geklärt**, ob die verwendete Overpass-Abfrage inhaltlich bereits genau so korrekt und vollständig ist, wie sie für das gewünschte Ziel sein müsste.

Das betrifft insbesondere die Frage,

- ob wirklich alle relevanten OSM-Objekte abgefragt werden
- ob die Tag-Auswahl fachlich vollständig genug ist
- und ob die spätere Auswertung auf dieser Datenbasis zuverlässig aufgebaut werden kann

## Zusammenhang mit dem OO-Konverter

Der derzeitige Ablauf ist deshalb zweistufig gedacht:

### 1. Tour Analyzer Pro

Dieses Projekt übernimmt aktuell vor allem:

- GPX laden
- Bereich bestimmen
- Overpass-Abfrage erzeugen
- OSM-Rohdaten laden
- Rohdaten exportieren

### 2. Overpass-RAW--JSON-to-Objekt-JSON

Dieses zweite Projekt übernimmt anschließend die Aufgabe, die exportierten Rohdaten in eine strukturiertere, objektorientierte Form zu überführen.

Repository:

- https://github.com/gabischatz/Overpass-RAW--JSON-to-Objekt-JSON

## Aktueller Stand

Vorhanden sind unter anderem bereits:

- Laden einer GPX-Datei
- Berechnung einer Bounding Box
- Aufbau einer kompakten Overpass-Abfrage
- Laden von OSM-Daten über Overpass
- Export der Overpass-Rohantwort
- Debug-Ansichten, Haltepunkte und zusätzliche Exporte

## Noch nicht erreicht

Was **noch nicht zuverlässig so funktioniert, wie gewünscht**:

- vollständige fachlich korrekte Tour-Analyse
- saubere automatische Verarbeitung aller Wegebeziehungen
- eine stabile und belastbare Auswertung der geladenen OSM-Daten
- ein durchgängig fertiger Tour-Analyzer
- eine insgesamt abgeschlossene und verlässlich funktionierende Gesamtlogik

## Enthaltene Datei

Dieses Repository enthält aktuell als Arbeitsstand:

- `tour-analyzer-pro-v17.html`

## Nutzung

1. Datei `tour-analyzer-pro-v17.html` im Browser öffnen
2. GPX-Datei laden
3. OSM-Daten über Overpass abrufen
4. Rohantwort exportieren
5. die exportierte Rohdatei im folgenden Projekt weiterverarbeiten:
   `Overpass-RAW--JSON-to-Objekt-JSON`

## Hinweis zur Einordnung

Dieses Repository sollte derzeit als **Entwicklungs- und Vorstufe** verstanden werden, **nicht** als fertige Lösung.

Der aktuelle Schwerpunkt liegt darauf,

- OSM-Daten aus einem GPX-Bereich zu laden,
- die Anfrage möglichst kompakt zu halten,
- die Rohdaten exportierbar zu machen
- und sie anschließend in eine besser auswertbare objektorientierte Struktur zu überführen.
