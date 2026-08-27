import importlib.util
import os
import unittest
from unittest.mock import patch


def load_dag_module():
    dag_file = os.getenv(
        "DAG_NEWSTOCK_FILE",
        "/opt/airflow/dags/DAGs_newstock.py",
    )
    spec = importlib.util.spec_from_file_location("dags_newstock_under_test", dag_file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeResponse:
    def __init__(self, status_code, payload, headers=None):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}
        self.text = str(payload)

    @property
    def ok(self):
        return 200 <= self.status_code < 300

    def json(self):
        return self._payload


class DataLabConversionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_dag_module()

    def setUp(self):
        self.module.DATALAB_KEY_POOL = self.module.DataLabKeyPool(
            ["fake-key-0", "fake-key-1"],
            max_concurrent_per_key=1,
        )

    def test_rotates_after_spend_cap_and_returns_markdown(self):
        post_responses = [
            FakeResponse(402, {"detail": "Spend cap reached"}),
            FakeResponse(
                200,
                {
                    "success": True,
                    "request_check_url": "https://www.datalab.to/api/v1/convert/request-1",
                },
            ),
        ]
        poll_response = FakeResponse(
            200,
            {
                "status": "complete",
                "success": True,
                "markdown": "# Converted document",
            },
        )

        with patch.object(self.module.requests, "post", side_effect=post_responses) as post_mock, patch.object(
            self.module.requests,
            "get",
            return_value=poll_response,
        ):
            markdown = self.module.convert_pdf_to_markdown(b"%PDF-test", "test.pdf")

        self.assertEqual("# Converted document", markdown)
        self.assertEqual(2, post_mock.call_count)
        self.assertEqual("fake-key-0", post_mock.call_args_list[0].kwargs["headers"]["X-API-Key"])
        self.assertEqual("fake-key-1", post_mock.call_args_list[1].kwargs["headers"]["X-API-Key"])

    def test_pdf_article_saves_markdown_content(self):
        article = {
            "id": "article-1",
            "code": "STB",
            "title": "Test filing",
            "link": "https://example.com/article-1",
            "pdf_link": "https://example.com/filing.pdf",
            "is_pdf": True,
        }

        with patch.object(self.module, "fetch_pdf", return_value=b"%PDF-test"), patch.object(
            self.module,
            "convert_pdf_to_markdown",
            return_value="# Filing\n\nPositive results.",
        ), patch.object(
            self.module,
            "analyze_text_sentiment",
            return_value={"sentiment_score": 0.7},
        ):
            processed = self.module.process_pdf_article(article)

        self.assertTrue(processed["is_pdf"])
        self.assertEqual("# Filing\n\nPositive results.", processed["content"])
        self.assertEqual(0.7, processed["sentiment_score"])

    def test_rotates_after_rate_limit(self):
        post_responses = [
            FakeResponse(429, {"detail": "Rate limit exceeded"}, {"Retry-After": "60"}),
            FakeResponse(
                200,
                {
                    "success": True,
                    "request_check_url": "https://www.datalab.to/api/v1/convert/request-2",
                },
            ),
        ]
        poll_response = FakeResponse(
            200,
            {"status": "complete", "success": True, "markdown": "# Rate-limit recovery"},
        )

        with patch.object(self.module.requests, "post", side_effect=post_responses) as post_mock, patch.object(
            self.module.requests,
            "get",
            return_value=poll_response,
        ):
            markdown = self.module.convert_pdf_to_markdown(b"%PDF-test", "rate-limit.pdf")

        self.assertEqual("# Rate-limit recovery", markdown)
        self.assertEqual(2, post_mock.call_count)
        self.assertEqual("fake-key-1", post_mock.call_args_list[1].kwargs["headers"]["X-API-Key"])

    def test_sentiment_is_numeric_and_clamped(self):
        self.assertEqual(1.0, self.module.normalize_sentiment_score({"sentiment_score": "2.5"}))
        self.assertEqual(-1.0, self.module.normalize_sentiment_score({"sentiment_score": -3}))
        self.assertEqual(0.0, self.module.normalize_sentiment_score({"sentiment_score": "invalid"}))


if __name__ == "__main__":
    unittest.main()
