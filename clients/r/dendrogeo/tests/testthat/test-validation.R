test_that("DGR identifiers are strictly validated", {
  expect_no_error(dendrogeo:::.dgr_validate_id("DGR-2026-0026"))
  expect_error(dendrogeo:::.dgr_validate_id("../DGR-2026-0026"), "DGR-YYYY-NNNN")
  expect_error(dendrogeo:::.dgr_validate_id("DGR-26-26"), "DGR-YYYY-NNNN")
})

test_that("artifact names cannot traverse paths", {
  expect_error(dendrogeo::dgr_artifact("DGR-2026-0026", "../private.json"), "Invalid artifact name")
})
