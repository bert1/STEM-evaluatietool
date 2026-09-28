# STEM-evaluatietool

Dit is een evaluatietool die kan gebruikt worden tijdens de STEM-lessen.

- **De tool zelf:** `STEM-Evaluatietool-vX.Y.Z.html` in deze map. Dubbelklikken
  volstaat, er is geen installatie nodig.
- **Broncode:** `stem-evaluatietool/` (zie de README daar).
- **Wat er veranderd is:** `stem-evaluatietool/CHANGELOG.md`.
- **Overdracht voor een volgende ontwikkelsessie:** `HANDOFF.md`.

## Bouwen en testen

```bash
npm ci      # eenmalig
npm test    # bouwt naar stem-evaluatietool/dist/ en draait de testreeks
```

Bij elke push bouwt en test GitHub dit automatisch (tabblad "Actions").
Na een geslaagde run staat het gebouwde bestand daar onder "Artifacts".
