---
title: "DendroGeo: traceable tree inventories and reviewed park surface evidence in a browser"
tags:
  - JavaScript
  - urban forestry
  - tree inventory
  - geographic information systems
  - research data provenance
authors:
  - name: "Nagihan Şirin"
    orcid: "0009-0003-7372-0973"
    affiliation: 1
  - name: "Sinan Şirin"
    orcid: "0009-0009-6303-5140"
    affiliation: 2
affiliations:
  - name: "Department of Landscape Architecture, Faculty of Agriculture, Ankara University, Türkiye"
    index: 1
  - name: "Independent software development for DendroGeo, Türkiye"
    index: 2
date: 17 October 2026
bibliography: references.bib
---

# Summary

DendroGeo is an open-source web application for collecting tree measurements and examining their spatial context in urban parks. A field record connects a tree's location, name or group, stem circumference and height with derived diameter, biomass and carbon estimates. A separate park workflow combines boundaries, remotely sensed land-cover evidence and reviewed surface geometries. Researchers can inspect source evidence, record corrections and publish a frozen DendroGeo report (DGR) containing the data, methods, spatial outputs and file checksums.

The application supports fieldwork on mobile devices, local storage during interrupted connectivity and later synchronization. Its research purpose is to preserve the connection between observations and the version of an analysis used in a report. Field observations, model estimates and externally sourced spatial evidence remain identifiable. A published package can be inspected independently of a user's account, while the application provides a shared workspace for preparing and reviewing the underlying records.

# Statement of need

An urban-park inventory may begin with field sheets, acquire coordinates and taxonomic labels, incorporate a boundary from a mapping service, and end with a spreadsheet of carbon estimates. When these steps are maintained separately, a corrected measurement or boundary can become detached from the result already reported. Changing remote services and unstable connectivity further complicate the work of distributed field teams.

DendroGeo addresses this problem through explicit observation, review and publication states. Its intended users include urban-forestry researchers, landscape researchers and teaching teams collecting georeferenced tree data. The field protocol stores circumference measured at 1.30 m above ground as the primary stem measurement and derives diameter as circumference divided by pi. Derived quantities are labeled as estimates rather than additional observations. A park's sampled trees remain distinct from its complete area: the sum over recorded trees is not evidence of a complete park inventory or a representative population estimate.

# State of the field

QGIS provides general spatial analysis, data editing and cartographic production [@qgis2026]. i-Tree Eco provides an established workflow for urban-forest assessment and ecosystem-service accounting [@itreeeco2026]. DendroGeo focuses on a narrower combination: browser-based field capture, offline synchronization, project-linked review and preservation of accepted evidence in a portable report package.

The implementation was developed as a connected collection-and-publication workflow because field entry, review status and the precise report snapshot need to share identifiers and provenance. A general GIS export alone does not supply that lifecycle. CSV and GeoJSON exports allow users to continue analysis in other tools. Biomass calculations reference existing allometry [@chave2014]; the software's contribution concerns workflow traceability and implementation, rather than a new biomass model. The system does not claim the analytic breadth of a desktop GIS or equivalence to the ecological methods of i-Tree.

# Software design

Domain modules implement numerical and geometric rules. Application modules coordinate tasks such as saving a measurement, accepting a surface correction and requesting publication. Adapters manage browser facilities, storage and external data services. Presentation modules render controls and report sections. Explicitly supplied dependencies make the numerical rules and workflow decisions testable without requiring a real account, a live map service or a writable production database.

This separation addresses a practical research risk: a change to a drawing tool or network retry must not silently change an accepted scientific record. The application distinguishes source classifications, provisional edits and accepted geometries. Remote-service failures are represented as unavailable evidence; incomplete geometry is not converted into an observation of zero buildings or water. Reviewed classifications are decisions with provenance, not independent accuracy assessments of the remote-sensing product. ESA WorldCover supplies baseline categorical evidence [@worldcover2021], while OpenStreetMap supplies separately attributed spatial context [@osm2026].

Browser delivery reduces installation requirements for field users, but map imagery and remote data still depend on network services. Local records and server-accepted records therefore have different states, and synchronization outcomes are surfaced to the user. Public reports use static files so that reading a frozen result does not require a database session. A manifest records SHA-256 checksums for individual artifacts; integrity checks establish whether those artifacts have changed, not whether the field observations are scientifically correct.

The report stores the analysis code revision, measurement period, source descriptions, model settings and review geometry. Published revisions are traceable by DGR identity and, where registered, a report DOI. The R and Python clients retrieve public manifest-listed files and check their hashes before returning the data. Their purpose is access and integrity verification; the research software described here is the complete DendroGeo system rather than the thin clients in isolation.

Automated checks cover module dependencies, generated assets, measurement transformations, review-state transitions, geometric operations and report integrity. Browser acceptance checks exercise mobile layouts, drawing, brush interaction, keyboard behavior and accessibility. These checks support maintainability across presentation and service changes. They do not replace local calibration of allometric equations or independent validation of park classifications. Applying a pantropical biomass equation to urban trees in Ankara requires an explicit statement of model-domain limitations.

# Research impact statement

The software supports a doctoral research workflow examining the carbon-storage performance of urban parks. A concrete public research output is the frozen Göksu Park report DGR-2026-0026, registered as DOI 10.5281/zenodo.23404310 [@sirinGoksu2026]. Its package contains 36 tree records, a machine-readable snapshot, a measurement CSV, spatial files, a rendered map, a report and a checksum manifest. The recorded measurement period is 28 September to 1 October 2026. Archived provenance identifies application version 3.0.0 and land-cover engine version 4.3.0, distinguishing the historical analysis environment from the current source tree.

The accompanying manuscript audit verified the eight manifest-listed artifacts and checked agreement among JSON and CSV record identities and counts. This provides a bounded, reproducible example for inspecting the observation-to-report connection. Earlier report revisions contain the same measurement CSV and are not additional independent surveys. No external adoption or peer-reviewed publication enabled by DendroGeo is asserted here. The public report demonstrates an implemented research workflow; it is not independent ecological validation or evidence of broad community uptake.

# AI usage disclosure

Generative AI tools assisted software implementation, refactoring, test preparation, documentation and manuscript drafting. OpenAI Codex, using GPT-6 for this manuscript revision, assisted with source inspection, editing and preparation of a read-only report audit. Automated regression and file-integrity checks provide technical evidence for specific behaviors; they do not substitute for human evaluation of scientific claims, authorship, data permissions or the manuscript. A complete historical tool inventory and the authors' confirmation of their review remain outstanding requirements in the submission preparation record.

# Acknowledgements

The work uses open-source software and attributed public spatial data. The authors report no external funding; development was supported through their own resources. Nagihan Şirin is a doctoral student in Landscape Architecture at Ankara University. Sinan Şirin developed the platform independently of his unrelated employment. Final author review and declarations remain required before submission.

# References

<!-- Author-confirmed preparation record: corresponding author Sinan Şirin (sinan@dendrogeo.org). No reported sponsorship, patents, commercial income, paid consultancy or other influencing relationships. Sinan is the platform developer. Final joint manuscript approval is pending. -->
