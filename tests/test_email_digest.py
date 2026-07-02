from __future__ import annotations

import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_ROOT = PROJECT_ROOT / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

import export_email_digest as digest_export


class EmailDigestBuilderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.candidates = [
            {
                "desertion_no": "SAMPLE-DESERTION-0001",
                "notice_no": "SAMPLE-NOTICE-0001",
                "kind_full_nm": "[Sample] Dog / Mixed",
                "notice_edt": "20260620",
                "days_until_notice_end": 1,
                "rescue_window_score": 92,
                "rescue_window_label": "Sample urgent review",
                "care_nm": "Sample Paws Shelter",
                "care_tel": "000-0000-0000",
                "happen_place": "Synthetic sample park entrance",
                "alert_reason": "Synthetic D-1 candidate for digest preview review.",
            },
            {
                "desertion_no": "SAMPLE-DESERTION-0002",
                "notice_no": "SAMPLE-NOTICE-0002",
                "kind_full_nm": "[Sample] Cat / Korean Shorthair",
                "notice_edt": "20260622",
                "days_until_notice_end": 3,
                "rescue_window_score": 78,
                "rescue_window_label": "Sample soon ending",
                "care_nm": "Sample Safe Care Center",
                "care_tel": "000-1111-2222",
                "happen_place": "Synthetic sample station exit",
                "alert_reason": "Synthetic D-3 candidate for digest preview review.",
            },
        ]

    def test_build_digest_uses_preview_boundary(self) -> None:
        digest = digest_export.build_digest(self.candidates)

        self.assertTrue(digest["preview_only"])
        self.assertIsNone(digest["recipient"])
        self.assertEqual(digest["candidate_count"], len(self.candidates))
        self.assertIn("safety_note", digest)
        self.assertTrue(digest["safety_note"].strip())
        self.assertIn("preview_note", digest)
        self.assertTrue(digest["preview_note"].strip())

    def test_html_rendering_does_not_require_recipients_or_credentials(self) -> None:
        digest = digest_export.build_digest(self.candidates)
        html = digest_export.build_html(digest)

        self.assertIn("<html", html)
        self.assertIn("Sample Paws Shelter", html)
        self.assertIn("Sample Safe Care Center", html)
        self.assertNotIn("recipient", html.lower())
        self.assertNotIn("DATABASE_URL", html)
        self.assertNotIn("DATA_GO_KR_SERVICE_KEY", html)

    def test_html_rendering_supports_empty_candidate_list(self) -> None:
        digest = digest_export.build_digest([])
        html = digest_export.build_html(digest)

        self.assertTrue(digest["preview_only"])
        self.assertIsNone(digest["recipient"])
        self.assertEqual(digest["candidate_count"], 0)
        self.assertIn("<html", html)


if __name__ == "__main__":
    unittest.main()
