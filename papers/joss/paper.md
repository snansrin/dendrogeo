---
title: "DendroGeo: a reproducible web GIS for tree inventories and urban park analysis"
authors:
  - name: "Nagihan Şirin"
    orcid: "0009-0009-6303-5140"
    affiliation: 1
  - name: "Sinan Şirin"
    affiliation: 2
affiliations:
  - name: "[Institution and department to confirm before submission]"
    index: 1
  - name: "[Institution or independent affiliation to confirm]"
    index: 2
date: 2026-10-17
bibliography: references.bib
---

# Summary

DendroGeo is an open-source, browser-based geographic information system for collecting tree measurements and examining urban parks. It connects georeferenced tree records, tree-level attributes, allometric biomass and carbon estimates, park boundaries, land-cover evidence, and quality-control notes in one workflow. Field teams can collect records in the browser, continue when connectivity is interrupted, and synchronize later. Analysts can inspect a park, review its surface classification, and create a frozen report package containing data, maps, metadata, source references, and a cryptographic content manifest.

The software distinguishes field observations from model-derived values and externally sourced spatial layers. A report preserves its input snapshot, analysis provenance, uncertainty summaries, and SHA-256 file checksums. Corrections to accepted analyses produce a new report identity rather than silently replacing an earlier publication. The browser application is designed for researchers and field teams who need an auditable connection between tree-level observations and park-scale spatial context.

# Statement of need

Urban tree inventories often combine field measurements, spatial boundaries, species or functional-group information, and derived biomass estimates. These components may be held in separate spreadsheets and GIS projects, making it difficult to trace which observations contributed to a park-level summary or to reproduce a published result after corrections. Field teams also work in settings with unreliable network access, while public datasets and map services can change independently of field records.

DendroGeo addresses this workflow problem by keeping each observation linked to its location and review state, applying explicitly documented allometric calculations, and recording the analysis snapshot used for each report. It is intended for urban forestry researchers, landscape and ecology students, park managers, and collaborators who need a shared map-based inventory and a clear account of data status. It does not replace field verification, a full-featured GIS, or ecological inference from plot sampling; it supplies a traceable collection and reporting workflow.

# State of the field

Desktop GIS software such as QGIS supports broad spatial analysis and cartographic production [@qgis2026], while tree-inventory platforms such as i-Tree Eco support structured urban-forest accounting [@itreeeco2026]. These tools address important parts of the workflow. DendroGeo is complementary: it focuses on browser-based field capture, park-linked collaboration, offline synchronization, review of contributed records, and the preservation of a report snapshot that joins tree records with separately identified park and land-cover evidence. Users can export spatial data for analysis in general GIS software rather than treating the browser as a replacement for it.

The contribution is therefore an integrated, auditable workflow rather than a new biomass equation or a claim of superior ecological accuracy. Biomass estimates depend on the selected allometric model, wood-density source, measurement quality, and assumptions documented in each report. Land-cover summaries depend on source resolution, acquisition date, raster-cell intersection, and any reviewed corrections. These products remain distinguishable in report metadata so that downstream users can select the evidence appropriate to their question.

# Software design

The application separates domain calculations, application workflows, data adapters, user-interface modules, and report-generation tools. This structure lets validation and transformations be exercised without a live database or map, while adapters retain responsibility for external services and storage. Regression checks guard key scientific calculations, report hashes, geometry handling, data-access boundaries, generated assets, and mobile interaction.

The client application uses a browser-first delivery model so that field teams can use standard devices without installing desktop GIS software. Offline queues support delayed synchronization, but the system reports synchronization outcomes instead of treating a local draft as a server-accepted observation. Published DGR artifacts are static files with a manifest, making a report portable and independently checkable. The read-only R and Python clients retrieve public artifacts and verify their manifest hashes; they do not access accounts or private records.

This design has trade-offs. Browser delivery reduces installation friction but depends on browser capabilities and network availability for remote map and data services. Offline editing requires explicit conflict and review handling. A static public report is easy to archive and mirror but is not a general query API. The software preserves these boundaries and documents source dates, resolution, missing inputs, and uncertainty instead of converting unavailable evidence into zero-valued results.

# Research impact statement

DendroGeo is being used in a doctoral research workflow on the carbon-storage performance of urban parks. Public DGR report packages provide concrete examples of the software's output and can be downloaded with the repository's read-only clients. These materials support near-term reuse and technical inspection. No external adoption or peer-reviewed publication enabled by the software is claimed in this draft; the authors should update this statement with verifiable citations, integrations, or independent use before submitting to JOSS.

# AI usage disclosure

Generative AI tools assisted with software implementation, documentation, and preparation of this manuscript draft. The authors remain responsible for the software, scientific claims, citations, data permissions, and final manuscript. They should verify all generated content and disclose any additional AI use according to the journal's current policy before submission.

# Acknowledgements

The authors acknowledge the maintainers of the open-source software, spatial datasets, and public data services cited in the repository's third-party license and data-source inventory. Specific financial support should be added only when confirmed by the authors.

# References

Chave, J., Réjou-Méchain, M., Búrquez, A., et al. (2014). Improved allometric models to estimate the aboveground biomass of tropical trees. *Global Change Biology*, 20, 3177–3190. https://doi.org/10.1111/gcb.12629

ESA WorldCover team. (2021). *ESA WorldCover 10 m 2021 v200*. https://doi.org/10.5281/zenodo.7254221

QGIS Development Team. (2026). *QGIS Geographic Information System*. https://qgis.org/

U.S. Forest Service. (2026). *i-Tree Eco*. https://www.itreetools.org/tools/i-tree-eco

Şirin, N. & Şirin, S. (2026). *DendroGeo: Küresel Ağaç Envanteri ve Karbon Veri Sistemi* (Version 3.0.0) [Software]. Zenodo. https://doi.org/10.5281/zenodo.22948643
