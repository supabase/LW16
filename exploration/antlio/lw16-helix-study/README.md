# LW16 S helix

Open `/lw16-helix-study/`. This experiment interprets the supplied reference as a radial arrangement of twisted vertical fins. It forms the Supabase mark in the negative space at the center.

## How it works

There are 44 fins. Their outer radius, height, angular spacing, thickness, and helical twist are identical in Ring and S center modes. The change affects the inner boundary of each fin. Each fin has one inner radius, sampled from its angular position near the Supabase contour. That radius stays constant through the fin’s height, so it remains a simple twisted panel. This produces real geometry around the opening. The mark is not an image covering the center.

The contour comes from the two paths in `apps/www/public/brand-assets/supabase-icon-green-transparent.svg` in the supabase/supabase repository. The center is slightly offset into the shared interior of those two shapes, so every radial ray has a valid intersection. A small depth-axis stretch compensates for the oblique camera. The silhouette is an optical interpretation of the existing mark, rather than a new brand asset.

The inner ends form a stepped approximation of the mark. They do not bend along its precise outline. Each fin keeps a constant radial span as it twists, and the gaps between the independent panels remain visible.

The opening has no added border or continuous icon outline. The separated edges of the fins suggest the mark, with visible gaps and a rough silhouette. Black faces hide lines behind the geometry. The scene contains only the sculpture. Floating text, glyph annotations, axis lines, grid, and orbit guides have been removed.

## Controls

Ring and S center compare the two openings with a smooth morph. Top view shows the silhouette from above. 3D view restores the oblique camera and its depth. Drag or use the arrow keys to orbit, Home resets the camera, and Space or the pause button stops the small ambient movement. Reduced motion starts paused and switches states directly.

The camera stays near the initial orientation during ambient motion, keeping the mark readable. The fins remain in the scene while orbiting. The renderer sleeps while hidden or outside the viewport.

## Verification

Run `node lw16-helix-study/mark.test.mjs` from the folder that holds the studies to check that every radial ray meets the contour, each fin keeps its own inner length throughout its height, and the outer helix stays exactly unchanged between states.

Browser checks cover both shape modes, top and oblique views, pause and play, keyboard orbit and reset, mobile controls, and the gallery preview. This is a local geometry exploration without a registration backend.
