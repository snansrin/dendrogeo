\name{dgr_get}
\alias{dgr_get}
\title{Read a public DendroGeo report}
\description{Fetches public report metadata and analysis JSON, verifying each artifact against the report SHA-256 manifest.}
\usage{dgr_get(report_id, base_url = "https://dendrogeo.org/rapor/", timeout = 20)}
\arguments{
  \item{report_id}{Public DGR identifier such as \code{"DGR-2026-0026"}.}
  \item{base_url}{Public report directory URL ending in \code{/rapor/}.}
  \item{timeout}{Per-request timeout in seconds.}
}
\value{A list containing \code{manifest}, \code{metadata}, and \code{data}.}
\details{Read-only. No account, private data, or Supabase access is used.}
