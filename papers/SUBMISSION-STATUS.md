# Journal submission preparation

Status checked 17 October 2026. No JOSS or Scientific Data application has been submitted by this agent; there is no journal tracking number or acceptance claim.

| Item | Evidence and present state | Required next action |
| --- | --- | --- |
| JOSS public development history | GitHub repository created 30 August 2026. This bounds its possible public history; it does not prove it was continuously public from that date. | JOSS currently requires more than six months of public, active development. Reassess no earlier than 1 March 2027 if a continuous public history from creation can be established. An older separate public development history would need evidence. |
| JOSS manuscript | paper.md rewritten with an actual public research report, architectural decisions, limitations, cited related tools and AI assistance. | Confirm affiliations, author order, contributions, research-use evidence, tool history and human review. Render the JOSS paper after author metadata is final. |
| JOSS correspondence | Current policy prohibits AI use in conversational author/editor/reviewer interactions except translation. | A human author must handle any editorial enquiry and review conversation. No AI-composed enquiry has been sent. |
| Scientific Data scope | Concrete Data Descriptor for the latest Göksu source package, DGR-2026-0026. Earlier revisions have identical measurement CSVs. | Fieldwork continues; the new candidate is a fixed 36-record primary-data snapshot. Do not represent revisions as independent observations. |
| Data integrity | Eight source artifact hashes verified; JSON and CSV contain matching 36 records. Audit evidence and read-only script are included. | Preserve original source artifacts and rerun audit on the exact files supplied to reviewers. |
| Scientific Data data licence | Source metadata declares CC BY-NC 4.0. Current repository guidance generally requires CC BY/CC0 for original non-sensitive data; inherited third-party terms have a limited exception. | Permission for a new primary-data-only CC BY 4.0 release was supplied on 17 October 2026. The local deposit candidate is prepared; no repository deposit has been registered. Do not silently relicense existing reports, OSM derivatives or third-party layers. |
| Dataset deposit | Existing DOI 10.5281/zenodo.23404310 is a source report accession; it is not asserted as a new dataset deposit. | Define final files and rights, create a suitable repository deposit and verify anonymous reviewer access. Record the actual accession only after registration. |
| Field protocol | Structured method fields are empty, but source report section 4.1 documents tape circumference at 1.30 m, height recorded to 0.1 m and civilian GNSS. Location accuracy is missing for 13 rows; local model calibration and independent surface accuracy are absent. | Investigators must supply actual sampling, devices, calibration and validation information, or accept explicit limitations in the manuscript. Do not invent methods. |
| Authors and declarations | Proposed manuscript authors are Nagihan Şirin and Sinan Şirin; affiliations, corresponding author, authorship agreement, own-resource funding and absence of influencing relationships have now been supplied; final text approval and detailed contributions remain pending. | Obtain each author's actual details, agreed contribution statement and manuscript approval. Confirmed ORCIDs: Nagihan 0009-0003-7372-0973; Sinan 0009-0009-6303-5140. Contact: nagihan@dendrogeo.org and sinan@dendrogeo.org; country Türkiye. |
| Scientific Data portal | https://submission.springernature.com/new-submission/41597/3 | Requires author account access and complete, truthful declarations; journal fees/waivers must be checked before any financial commitment. |

The evidence audit establishes file identity and structural consistency. It does not certify scientific validity, sampling representativeness, data rights or journal eligibility. The source report QA flag is an internal workflow state.

## Verification command

Run from the repository root with Python 3.10 or newer:

```console
python -m unittest discover -s papers/tools -p "test_*.py" -t papers/tools -v
```

## Policy sources

- JOSS submission gates and AI policy: https://joss.readthedocs.io/en/latest/submitting.html
- JOSS manuscript structure: https://joss.readthedocs.io/en/latest/paper.html
- Scientific Data manuscript structure: https://www.nature.com/sdata/submission-guidelines
- Scientific Data repository and licence requirements: https://www.nature.com/sdata/policies/repositories
- Scientific Data authorship and publishing declarations: https://www.nature.com/sdata/policies/editorial-and-publishing-policies

## Author information supplied 17 October 2026

Nagihan Şirin: doctoral student, Department of Landscape Architecture, Faculty of Agriculture, Ankara University, Türkiye; agreement to authorship of both manuscripts confirmed by the user. Sinan Şirin: system developer; unrelated employer is not a project affiliation. No external funding; development supported by the authors themselves. Sinan is confirmed as corresponding author and no influencing relationships are reported. Detailed contributions and final manuscript approval remain pending. Agreement to authorship is not treated as approval of the final manuscript.

Further author declaration: Sinan Şirin is the corresponding author (sinan@dendrogeo.org). No sponsorship, patents, commercial income, paid consultancy or other influencing relationships were reported. His platform-development role is disclosed. Final manuscript approval and detailed contributions remain pending.

## Source withdrawal — checked 19 October 2026

DGR-2026-0026 was withdrawn on 17 October 2026 and its report artifacts were removed (commit 472a247). The existing audit is historical evidence, not a currently reproducible audit of a public report. Manuscript source claims and the deposit candidate require revalidation against a new author-approved dataset. Tests now generate explicitly synthetic packages in temporary directories; passing them does not validate the withdrawn observations or make either manuscript submission-ready.
