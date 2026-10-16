#' Read a public DendroGeo report
#'
#' Fetches the public report manifest, metadata, and data JSON. Each artifact is
#' checked against the SHA-256 recorded in the manifest before it is parsed.
#' This function is read-only and does not access user accounts or private data.
#'
#' @param report_id Public DGR identifier such as \code{"DGR-2026-0026"}.
#' @param base_url Public report directory URL ending in \code{/rapor/}.
#' @param timeout Per-request timeout in seconds.
#' @return A list containing \code{manifest}, \code{metadata}, and \code{data}.
#' @export
dgr_get <- function(report_id, base_url = "https://dendrogeo.org/rapor/", timeout = 20) {
  .dgr_validate_id(report_id)
  manifest <- .dgr_json(.dgr_read(.dgr_url(base_url, report_id, "manifest.json"), timeout), "manifest.json")
  if (!identical(manifest$report_id, report_id)) stop("Manifest report_id does not match request", call. = FALSE)
  metadata <- .dgr_json(.dgr_artifact_from_manifest(report_id, "metadata.json", manifest, base_url, timeout), "metadata.json")
  data <- .dgr_json(.dgr_artifact_from_manifest(report_id, "data.json", manifest, base_url, timeout), "data.json")
  if (!identical(metadata$identifier, report_id)) stop("metadata identifier does not match request", call. = FALSE)
  list(manifest = manifest, metadata = metadata, data = data)
}

#' Download a manifest-listed DendroGeo artifact
#'
#' @param report_id Public DGR identifier.
#' @param name A basename present in the report manifest, for example
#'   \code{"park.geojson"}.
#' @param base_url Public report directory URL.
#' @param timeout Per-request timeout in seconds.
#' @return Raw artifact bytes after checksum verification.
#' @export
dgr_artifact <- function(report_id, name, base_url = "https://dendrogeo.org/rapor/", timeout = 20) {
  .dgr_validate_id(report_id)
  if (!is.character(name) || length(name) != 1L ||
      !grepl("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$", name) || name %in% c(".", "..")) {
    stop("Invalid artifact name", call. = FALSE)
  }
  manifest <- .dgr_json(.dgr_read(.dgr_url(base_url, report_id, "manifest.json"), timeout), "manifest.json")
  if (!identical(manifest$report_id, report_id)) stop("Manifest report_id does not match request", call. = FALSE)
  .dgr_artifact_from_manifest(report_id, name, manifest, base_url, timeout)
}

.dgr_artifact_from_manifest <- function(report_id, name, manifest, base_url, timeout) {
  entries <- Filter(function(x) identical(x$name, name), manifest$files)
  if (length(entries) != 1L || !grepl("^[a-f0-9]{64}$", entries[[1L]]$sha256)) {
    stop("Artifact is not protected by the report manifest", call. = FALSE)
  }
  raw <- .dgr_read(.dgr_url(base_url, report_id, name), timeout)
  actual <- digest::digest(raw, algo = "sha256", serialize = FALSE)
  if (!identical(actual, entries[[1L]]$sha256)) stop("SHA-256 mismatch for artifact", call. = FALSE)
  raw
}

.dgr_validate_id <- function(report_id) {
  if (!is.character(report_id) || length(report_id) != 1L ||
      !grepl("^DGR-[0-9]{4}-[0-9]{4}$", report_id)) {
    stop("report_id must match DGR-YYYY-NNNN", call. = FALSE)
  }
}

.dgr_url <- function(base_url, report_id, name) {
  if (!is.character(base_url) || length(base_url) != 1L || !grepl("^https://", base_url)) {
    stop("base_url must be an HTTPS URL", call. = FALSE)
  }
  paste0(sub("/+$", "", base_url), "/", report_id, "/", name)
}

.dgr_read <- function(url, timeout) {
  response <- httr2::request(url) |>
    httr2::req_user_agent("dendrogeo-r-client/0.1.0") |>
    httr2::req_timeout(timeout) |>
    httr2::req_perform()
  httr2::resp_body_raw(response)
}

.dgr_json <- function(raw, label) {
  tryCatch(jsonlite::fromJSON(rawToChar(raw), simplifyVector = FALSE),
    error = function(e) stop(sprintf("Invalid JSON in %s: %s", label, conditionMessage(e)), call. = FALSE))
}

