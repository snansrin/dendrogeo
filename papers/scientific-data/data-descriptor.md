# Working draft: Data Descriptor

**Submission status:** internal working draft. This document is not a journal submission and contains author-confirmation and dataset-deposit requirements. No private user measurements are included or presumed licensed.

## Title

Georeferenced urban park tree inventories and linked land-cover evidence from public DendroGeo reports

## Authors

Nagihan Şirin¹, Sinan Şirin²

¹ [Confirm institution, department, and country]  
² [Confirm institution or independent affiliation and country]  
Corresponding author: [Confirm]

## Abstract

This Data Descriptor describes a versioned collection of urban-park tree inventory and spatial evidence files released as public DendroGeo report packages. Each package can include reviewed tree measurements, park geometry, surface geometry, analysis metadata, and a SHA-256 manifest. The files link spatial observations to a documented report snapshot while keeping field measurements, external spatial sources, and derived estimates identifiable. The collection is limited to records whose rights holders authorized public release; it does not include private user records or unpublished submissions. The data can support reanalysis of tree-inventory attributes, park geometry, and reported land-cover evidence. The deposited collection version, included report identifiers, licensing scope, and repository accession must be completed and checked against the final public files before submission.

## Background & Summary

Urban-park studies combine field observations with spatial context, but these inputs can be difficult to reuse when file structure, measurement definitions, and processing provenance are not described consistently. DendroGeo report packages provide a structured, versioned representation of publicly released park analyses. A report identity binds its metadata, analysis snapshot, and output files to a content manifest. This descriptor is intended to describe a curated dataset assembled from eligible public reports, not to present new ecological conclusions or interpret park rankings.

The collection must include only reports for which authorship, data rights, consent, and source attributions permit redistribution. User records, photographs, or precise locations must not be included merely because they are visible to an authenticated project member. This eligibility rule is a condition of the dataset definition and must be checked for every record in the deposited version.

## Methods

### Source records

Eligible source records are public DGR report packages under https://dendrogeo.org/rapor/DGR-YYYY-NNNN/. Each report contains a manifest.json with file names and SHA-256 hashes, metadata.json with the report identity and license declaration, and data.json with the frozen analysis snapshot. Depending on the report, packages may also contain olcum.csv, park.geojson, surface.geojson, a rendered map, and a PDF. The exact report identifiers and included files for this dataset release must be listed in the Data Record.

The source metadata, public status, report hash, rights holder, and permitted reuse scope should be checked before extraction. Exclude withdrawn reports and any reports that lack explicit permission for the proposed reuse. Record the DendroGeo software version and source commit used to generate each report where available.

### Processing

The released files should be copied without editing from the selected immutable report packages. If a collection-level index or harmonized table is produced, preserve each source DGR identifier and file hash, document every transformation, retain source column names in a data dictionary, and publish a reproducible script. Do not combine source measurements and derived values into an unlabeled field. Report-level analysis methods and assumptions remain described in each package's metadata and report.

### Ethics and permissions

The authors must verify consent, data ownership, location sensitivity, and any institutional ethics requirements for each included record. This descriptor does not authorize release of records that were collected for another purpose. Any record whose permissions are unclear must be excluded until clarified by its rights holder.

## Data Records

**Repository:** [Deposit the complete collection in a suitable trusted repository and insert the reserved/public accession and DOI.]

The proposed collection structure is:

- README.md — collection scope, citation, and reuse conditions;
- manifest.json — collection version and checksums;
- reports/<DGR-ID>/metadata.json — report identity, sources, license, and provenance;
- reports/<DGR-ID>/data.json — frozen report data;
- optional olcum.csv, park.geojson, and surface.geojson only when included in the source package and authorized for redistribution;
- data-dictionary.csv — variable name, definition, unit, source, and missing-value handling.

The final version must replace this proposed structure with the files actually deposited and list every report identifier. A DGR identifier is a platform report identity; it is not a dataset DOI.

## Technical Validation

For each source report, validate the manifest schema, recompute every listed SHA-256 digest, compare the report identifier across the manifest and metadata, validate JSON/CSV/GeoJSON parsing, and record the result. Check that GeoJSON coordinates and geometry types are valid and that private or unpublished records are absent. Re-run the released client tests against the deposited copy. Report counts and validation outcomes only after the final eligible dataset has been assembled; do not infer them from the current site index.

## Usage Notes

Use report-level metadata to interpret units, measurement periods, analysis sources, and license. The accompanying Python and R clients provide read-only retrieval and file-integrity verification. The clients do not recalculate carbon estimates or substitute for source-specific spatial attribution. Users should cite both this dataset release and the original source datasets listed in each report.

## Data Availability

The final, authorized collection will be deposited at [repository] under accession [DOI/accession]. Until that deposit is complete, this working draft does not define a released dataset and must not be cited as one.

## Code Availability

DendroGeo source code is available at https://github.com/snansrin/dendrogeo and archived software releases are identified by their software DOI. The read-only R and Python clients are included under clients/. Their code license is MIT; each report's metadata states the data license and reuse scope for that report.

## Author Contributions

[The authors must confirm contributions using the journal's requested format before submission.]

## Competing Interests

[The authors must confirm and state any competing interests or declare none.]

## Funding

[Add confirmed funding information or state that no specific funding supported the work.]

## References

Chave, J. et al. Improved allometric models to estimate the aboveground biomass of tropical trees. *Global Change Biology* 20, 3177–3190 (2014). https://doi.org/10.1111/gcb.12629

ESA WorldCover team. *ESA WorldCover 10 m 2021 v200*. https://doi.org/10.5281/zenodo.7254221
