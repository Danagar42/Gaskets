# ACTIVE_SPEC (Revision 1) — Standards Knowledge Base Desktop UI & Parametric CAD Excellence

## 1. Problem Statement & User Feedback
The user provided a live visual screenshot of the application running on an engineering desktop workstation. While unit tests passed:
1. **Critical Layout Defect:** The central column containing the passport card, filters, and the entire master dimensions table was squashed into an unreadable, narrow vertical sliver (~50-80px width) between the sidebar and detail pane.
   - Root Cause: Missing CSS width definitions in `standards-base/styles.css` caused the right sidebar to rely on nonexistent Tailwind JIT arbitrary classes (`w-[420px]`). Combined with `flex-shrink: 0`, the right sidebar expanded to fit the unconstrained SVG canvas width (560-680px), while the central column had no `min-w-0` / explicit flex basis, resulting in catastrophic layout collapse.
2. **CAD Vector Scaling Defect:** For small nominal sizes (e.g. M2 spring washer with inner d=2.1, outer D=3.1, thickness s=0.5), the geometry was rendered with an outer radius of only ~6px, appearing as a microscopic speck in the center of a huge 560x340 black canvas.
   - Root Cause: Drawing templates had hardcoded low scale caps (e.g., `Math.min(150 / outerD, 3.8)` in `renderSpringWasher` and `renderFlatWasher`, `Math.min(..., 4.2)` in `renderHexNut`). These caps artificially prevented small parts from scaling up to fill the viewport comfortably.
3. **Glass 2.0 CSS & Dark Theme Styling Inconsistencies:**
   - Buttons (`#btnCopyCallout`, `#btnExportSvg`) and links had non-existent arbitrary Tailwind utility classes (`dark:bg-indigo-950/60`, `dark:bg-slate-800/80`), causing them to fall back to bright white backgrounds in dark mode, appearing as blinding, unstyled white boxes.
   - All critical layout structures must be backed by explicit, reliable CSS rules in `standards-base/styles.css`, not fragile arbitrary utility classes.

## 2. Behavioral Requirements

### A. Robust Desktop 3-Column Layout
1. Dedicated CSS layout rules in `standards-base/styles.css`:
   - Left Sidebar (`#mainSidebar` / `.sidebar-panel`): fixed width 280px (or 300px), with smooth collapse to 0px when toggled.
   - Central Main Workspace (`.content-panel`): `flex: 1 1 auto; min-width: 0;` ensuring it dynamically claims all available space (typically 50-65% of viewport width), providing ample room for `#passportCard`, `#tableControlsBar`, and `#dimensionsTable`.
   - Right Detail Sidebar (`#detailSidebar` / `.detail-panel`): fixed width 420px (`width: 420px; min-width: 420px; max-width: 420px; flex-shrink: 0;`).
2. Central table layout:
   - Sticky header with clear contrasting background and border.
   - Generous cell padding, readable typography with `font-mono-num`.
   - Guaranteed minimum table width or horizontal scroll if needed, but never squashed columns.

### B. Parametric 2D CAD Scaling & Readability
1. Dynamic Viewport Scaling:
   - Every part (from M1 to M100) must scale to comfortably fill approximately 55% to 75% of the SVG canvas width/height.
   - Remove arbitrary fixed upper caps (like `3.8` or `4.2`) that penalize small diameters.
   - For tiny fasteners (M1 - M4): outer diameter / width across flats must be scaled up to at least 140-200px on canvas so that section hatches, chamfers, slit gaps (15° for grovers), and dimension leaders are crisp, legible, and proportionate.
   - For large fasteners (M48 - M100): scale down smoothly without clipping or overflowing canvas boundaries.
   - Maintain minimum label font sizes and arrow dimensions so text remains crisp and readable at all scales.

### C. Glass 2.0 Dark & Light Theme Styling
1. All buttons, cards, inputs, and badges must have explicit, reliable styles in `standards-base/styles.css`:
   - Action buttons (`.btn-primary`, `.btn-secondary`, `#btnCopyCallout`, `#btnExportSvg`):
     - In Light mode: clean crisp glass/solid styling.
     - In Dark mode: dark translucent slate/indigo backgrounds with soft borders, NEVER pure white boxes.
   - Header navigation link (`← До розрахунку «Прокладки»`): perfectly legible in both light and dark themes.
   - Passport card: clear contrast, readable metadata badges, no clipped text.

### D. Zero Regressions & Architectural Integrity
1. 100% preservation of `check.cjs` (22/22 suites, 0 Excel differences).
2. All 10 standards, 274 sizes verified in both CAD Light and Blueprint Dark themes.
3. 100% offline (0 remote CDN / font dependencies).
4. Desktop-only engineering application.
