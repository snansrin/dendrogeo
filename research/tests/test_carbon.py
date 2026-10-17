import copy
import json
import math
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research" / "carbon"))
from reference import calculate, load_policy
from uncertainty import diagnose
from validation import evaluate_local, evaluate_repeats


class CarbonResearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = json.loads((ROOT / "test/fixtures/carbon-reference-v1.json").read_text(encoding="utf-8"))

    def setUp(self):
        self.row = dict(self.fixture["rows"][0])

    def test_frozen_vectors_and_density_policy(self):
        policy = load_policy()
        self.assertEqual(len(policy["species_groups"]), 49)
        self.assertEqual(len(policy["species_kg_m3"]), 16)
        self.assertEqual(policy["defaults_kg_m3"], {"İBRELİ": 446, "YAPRAKLI": 541})
        for row, expected in zip(self.fixture["rows"], self.fixture["expected"]):
            for key, value in calculate(row).items():
                if isinstance(value, str):
                    self.assertEqual(value, expected[key])
                else:
                    self.assertTrue(math.isclose(value, expected[key], rel_tol=1e-12, abs_tol=1e-12))

    def test_invalid_inputs_and_group_mismatch(self):
        for value in (0, -1, True, "10", float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                calculate(dict(self.row, girth_cm=value))
        with self.assertRaises(ValueError):
            calculate(dict(self.row, grp="YAPRAKLI"))
        with self.assertRaises(ValueError):
            calculate(dict(self.row, species="UNKNOWN"))

    def test_sensitivity_separates_sources_and_does_not_mutate(self):
        payload = {"rows": [self.row]}
        before = copy.deepcopy(payload)
        result = diagnose(payload)
        self.assertEqual(payload, before)
        self.assertGreater(result["measurement"]["std_kg_c"], 0)
        self.assertEqual(result["density"]["status"], "not_estimated")
        self.assertEqual(result["sampling"]["status"], "not_estimated")
        self.assertAlmostEqual(result["model"]["std_kg_c"], calculate(self.row)["total_carbon"] * .22)
        scenario = diagnose({"rows": [self.row], "settings": {"density_cv": .1, "density_correlation": "shared"}})
        self.assertGreater(scenario["density"]["std_kg_c"], 0)
        with self.assertRaises(ValueError):
            diagnose({"rows": [self.row], "settings": {"density_cv": .1}})

    def test_shared_model_error_does_not_shrink_as_independent(self):
        one = diagnose({"rows": [self.row]})
        two = diagnose({"rows": [self.row, dict(self.row, id="other")]})
        self.assertAlmostEqual(two["model"]["std_kg_c"], 2 * one["model"]["std_kg_c"])
        self.assertAlmostEqual(two["measurement"]["std_kg_c"], math.sqrt(2) * one["measurement"]["std_kg_c"])

    def test_sampling_requires_explicit_supported_design(self):
        rows = [self.row, dict(self.row, id="other", height_m=2*self.row["height_m"])]
        design = {"type": "srs_without_replacement", "unit": "tree", "population_size": 10,
                  "equal_probability": True, "complete_response": True, "sampling_frame": "SYNTHETIC TEST FRAME"}
        result = diagnose({"rows": rows, "sampling_design": design})["sampling"]
        values = [calculate(r)["total_carbon"] for r in rows]
        self.assertAlmostEqual(result["estimated_frame_total_kg_c"], sum(values)/2*10)
        variance = (values[0]-values[1])**2/2
        self.assertAlmostEqual(result["std_kg_c"], math.sqrt(100*.8*variance/2))
        for invalid in (dict(design, complete_response=False), dict(design, population_size=1), dict(design, sampling_frame="")):
            with self.assertRaises(ValueError):
                diagnose({"rows": rows, "sampling_design": invalid})
        with self.assertRaises(ValueError):
            diagnose({"rows": [self.row, self.row], "sampling_design": design})

    def test_repeat_pair_bias_rmse_and_duplicate_protection(self):
        rows = [{"id": "test-1", "initial": {"girth_cm": 100, "height_m": 10}, "repeat": {"girth_cm": 102, "height_m": 11}}]
        result = evaluate_repeats(rows)["metrics"]
        self.assertEqual(result["girth_cm"]["bias"], 2)
        self.assertEqual(result["height_m"]["rmse"], 1)
        self.assertAlmostEqual(result["girth_cm"]["technical_error_of_measurement"], math.sqrt(2))
        with self.assertRaises(ValueError):
            evaluate_repeats(rows + rows)

    def test_local_comparison_never_claims_validation_or_accepts_circular_reference(self):
        row = dict(self.row, reference_agb_kg=calculate(self.row)["agb"], independent=True,
                   reference_kind="measured_dry_agb", reference_source="SYNTHETIC UNIT FIXTURE, NOT FIELD EVIDENCE")
        result = evaluate_local([row])
        self.assertEqual(result["overall"]["rmse"], 0)
        self.assertFalse(result["production_equation_modified"])
        for invalid in (dict(row, independent=False), dict(row, reference_kind="same_allometry"), dict(row, reference_source="")):
            with self.assertRaises(ValueError):
                evaluate_local([invalid])


if __name__ == "__main__":
    unittest.main()
