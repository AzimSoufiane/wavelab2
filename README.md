# WaveLab 3D — Mod-M115

Simulateur 3D interactif de propagation électromagnétique réalisé pour le module **M115** de l'**ENSA Tanger**. L'application permet de visualiser et de mesurer, en temps réel, les phénomènes d'ondes vus au cours du semestre : dioptres, incidence oblique TE/TM, milieux à pertes, guides d'ondes et ondes stationnaires (TOS/ROS).

L'interface combine une scène **Three.js** plein écran, un panneau de paramètres flottant, un oscilloscope deux voies et un tableau d'équations rendues avec **KaTeX**.

## Fonctionnalités

### Chapitre 1 — Dioptre
- Modèles de frontière : dioptre semi-infini et lame diélectrique finie (Fabry-Pérot).
- Incidence oblique de 0° à 88° avec loi de Snell-Descartes et inclinaison du vecteur de Poynting.
- Polarisations **TE** et **TM**, courbes de Fresnel `R(θi)` / `T'(θi)`, angle de Brewster et réflexion totale interne (θl).
- Formes de texture de surface : circulaire, rectangulaire, créneaux, triangles, fentes/cavités et sinusoïdale.

### Chapitre 2 — Pertes
- Bibliothèque de matériaux : air, verre, polystyrène, béton, cuivre, métal (PEC), etc.
- Milieux à pertes : facteur de perte `tan δ`, conductivité `σ`, profondeur de peau `δ` et atténuation en dB/m.
- Régime de bon conducteur, impédance intrinsèque complexe `η` et conducteur parfait (Γ = −1, E = 0 dans le métal).

### Chapitre 3 — Oscilloscope & ondes guidées
- Deux sondes déplaçables (voie A cyan, voie B ambre) avec historique, valeur crête-à-crête et RMS.
- Mesure du déphasage `Δφ` entre sondes et du coefficient de transmission.
- Ondes stationnaires : TOS = |Γ|, ROS = (1 + |Γ|) / (1 − |Γ|), enveloppe `Emax` / `Emin`.
- Guide d'ondes rectangulaire : modes TE_mn / TM_mn, fréquence de coupure `fc`, vitesse de phase et longueur d'onde guidée.
- Remontée à l'impédance d'un milieu inconnu à partir de mesures (§3.4.2).

### Outils généraux
- Sélection de caméra : perspective, dessus, profil, incidence, isométrique.
- Affichage configurable des vecteurs E/H, des rayons, de la surface, de l'enveloppe et du trièdre.
- Préréglages d'exercices et sauvegarde/restauration d'un état via l'URL.
- Export du rapport de simulation au format PDF (jsPDF), avec profil académique (étudiant, enseignant, établissement) conservé localement.
- Détection des préférences système (mouvement/transparence réduits) avec repli CSS pour l'effet de réfraction.

## Stack technique

| Domaine | Technologies |
| --- | --- |
| Interface | React 19, TypeScript 7, Vite 8 |
| Styles | Tailwind CSS 4, `glisse`, `lucide-react`, `motion` |
| 3D | Three.js (`three`, `@types/three`) |
| Math / rendu | KaTeX, jspdf |
| IA | `@google/genai` (API Gemini côté serveur) |
| Tests | `node:test` + `node:assert/strict` |

## Installation

Prérequis : **Bun** (le dépôt contient un `bun.lock`) ou Node.js avec npm.

```bash
# Clonage du dépôt
git clone https://github.com/AzimSoufiane/wavelab2.git
cd wavelab2

# Installation des dépendances
bun install
# ou : npm install
```

Copiez le modèle d'environnement puis renseignez vos valeurs :

```bash
cp .env.example .env
```

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | Clé nécessaire aux appels à l'API Gemini (injectée par AI Studio via le panneau *Secrets*). |
| `APP_URL` | URL publique de l'applet, utilisée pour les liens auto-référentiels et les endpoints OAuth. |

## Scripts

```bash
bun run dev       # serveur de développement Vite sur http://localhost:3000 (0.0.0.0)
bun run build     # build de production dans dist/
bun run preview   # prévisualisation du build
bun run lint      # vérification des types (tsc --noEmit)
bun run clean     # suppression de dist/ et server.js
```

## Structure du projet

```text
.
├── index.html               # point d'entrée HTML (lang="fr", thème sombre)
├── metadata.json            # métadonnées de l'applet et capacités AI Studio
├── vite.config.ts           # plugins React/Tailwind, alias "@", copie des assets
├── .env.example             # modèle de configuration
└── src
    ├── main.tsx             # montage de l'application
    ├── App.tsx              # état global, chapitres et agencement des couches
    ├── types.ts             # types partagés (WaveConfig, WallGeometry, sondes…)
    ├── index.css            # styles globaux et thème
    ├── physics
    │   ├── waveEngine.ts          # calculs électromagnétiques et paramètres
    │   ├── waveEngine.test.ts     # tests physiques (Fresnel, PEC, peau, TOS/ROS…)
    │   └── wallBuilder.ts         # géométrie des parois texturées
    ├── components
    │   ├── ThreeViewport.tsx      # scène 3D et animation
    │   ├── ControlPanel.tsx       # panneau de réglages par chapitre
    │   ├── HeaderBar.tsx          # barre supérieure, presets, export
    │   ├── Oscilloscope.tsx       # visualisation des deux voies
    │   ├── KatexEquations.tsx     # équations affichées
    │   ├── AcademicProfileModal.tsx
    │   └── ParamTooltip.tsx
    └── utils
        ├── exportUtils.ts         # presets sérialisés dans l'URL
        ├── pdfReport.ts           # génération du rapport PDF
        ├── pdfReport.test.ts
        └── academicProfile.ts     # profil académique en stockage local
```

## Tests

Les tests utilisent le runner natif de Node et couvrent les cas analytiques du module : dioptre verre-air, angle de Brewster, réflexion totale, conducteur parfait, épaisseur de peau du cuivre, résonance de Fabry-Pérot, TOS/ROS et cohérence entre le champ 3D et les formules.

```bash
npx tsx --test src/physics/waveEngine.test.ts src/utils/pdfReport.test.ts
```

## Contexte académique

Projet pédagogique associé au module **Mod-M115 — Propagation et guides d'ondes** (ENSA Tanger). Les préréglages et les tests reprennent les exercices et les notations du cours (`Γ`, `η`, `δ`, `fc`, `R + T' = 1`, …).

## Licence

Aucune licence n'est actuellement définie dans le dépôt.
