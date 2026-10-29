# PNG output language correction

Explicit user request: EN-selected PNG downloads still contain Turkish labels. This change translates presentation text at the canvas draw/measure boundary using the existing runtime dictionary, including surface summaries, NDVI, preview/accepted status and the legacy park export. Park/stage names and IDs remain original; numbers, geometry, areas, classes, colours and algorithms are unchanged. Runtime language switching is read at draw time. No database or publication writes.
