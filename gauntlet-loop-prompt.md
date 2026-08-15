# Gauntlet-Loop-Prompt: „Terra Incognita"

> Diesen Prompt komplett in Claude Code einfügen und laufen lassen.

---

ultracode

**Ziel:** Baue ein spielbares Erkundungsspiel (im Browser, sofort startbar), das ein einziges Gefühl trifft: *Ich bin der erste Mensch, der diese Welt versteht.* Jede Welt (jeder Seed) hat andere Naturgesetze – Ökologie, Kausalitäten und was „Gefahr" bedeutet sind pro Welt anders verwoben, aber in sich stimmig, nie zufälliges Rauschen. Wissen entsteht ausschließlich durch Beobachten, Experimentieren und Schlussfolgern: keine Tutorials, keine Erklärtexte, keine Quest-Marker. Ein Tod an etwas Unverstandenem muss sich wie meine Entdeckungslücke anfühlen, nie wie Willkür.

**Bar:** Lege selbst eine Referenzmappe an aus Screenshots und Gameplay-Clips von **Outer Wilds** (der Moment der Erkenntnis) und **Subnautica** (Ehrfurcht und Angst vor dem Unbekannten). Diese Bar taugt, weil beide Spiele dem Zielgefühl am nächsten kommen, ohne unser Kernkonzept (pro Welt divergente Regeln) zu besitzen – wir messen uns also am Gefühl, nicht an kopierbaren Features.

**Methode – Gauntlet Loop:**

1. Zerlege das Spiel selbst in die kleinsten separat verbesserbaren Teile (z. B. Movement, Atmosphäre, Sound, Regel-Generator, Entdeckungs-Feedback, Erste-Minute-Erlebnis …). Der Schnitt ist deine Entscheidung.
2. Jedes Teil bekommt einen **Builder**-Subagenten und einen davon getrennten **Kritiker**-Subagenten mit frischem Kontext. Der Kritiker bekommt nur zwei Dinge blind im A/B vorgelegt: unser echtes Ergebnis (Screenshot, Clip oder spielbarer Stand) und die Bar. Er benennt die eine größte Lücke zum Zielgefühl und schickt das Teil damit zurück an den Builder.
3. **Kein Rundenlimit.** Der Loop läuft pro Teil, bis der Kritiker unser Ergebnis im Blindvergleich bevorzugt – oder ich stoppe.
4. Pflege eine simple **Live-HTML-Fortschrittsseite**: pro Teil der aktuelle Screenshot, das letzte Kritiker-Urteil im Wortlaut und der Rundenzähler.

Alle weiteren Details – Engine, Umfang, Reihenfolge, Prüfkriterien – entscheidest du.
