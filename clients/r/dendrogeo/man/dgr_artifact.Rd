\name{dgr_artifact}
\alias{dgr_artifact}
\title{Download a verified public report artifact}
\description{Downloads a manifest-listed report artifact and verifies its SHA-256 digest before returning it.}
\usage{dgr_artifact(report_id, name, base_url = "https://dendrogeo.org/rapor/", timeout = 20)}
\arguments{
  \item{report_id}{Public DGR identifier.}
  \item{name}{Artifact basename present in the report manifest.}
  \item{base_url}{Public report directory URL.}
  \item{timeout}{Per-request timeout in seconds.}
}
\value{Raw bytes for the verified artifact.}

