import datetime
import unittest
from types import SimpleNamespace

from src.api.routers.stocks import _fetch_daily_summary


def summary_row(symbol, trade_date, close):
    return SimpleNamespace(
        symbol=symbol,
        trade_date=trade_date,
        open=close - 100,
        high=close + 100,
        low=close - 200,
        close=close,
        volume=1_000,
    )


class FakeDatabase:
    def __init__(self, rows_by_date):
        self.rows_by_date = rows_by_date
        self.queried_dates = []

    def execute(self, _query, params):
        trade_date = params[0]
        self.queried_dates.append(trade_date)
        return self.rows_by_date.get(trade_date, [])


class FetchDailySummaryTests(unittest.TestCase):
    def test_fills_missing_symbols_from_older_days(self):
        newest = datetime.date(2026, 7, 16)
        previous = datetime.date(2026, 7, 15)
        db = FakeDatabase({
            newest: [summary_row("SAB.VN", newest, 46_350)],
            previous: [
                summary_row("ACB.VN", previous, 23_100),
                summary_row("SAB.VN", previous, 46_050),
            ],
        })

        result = _fetch_daily_summary(db, newest, max_lookback=2)

        self.assertEqual([row["symbol"] for row in result], ["ACB", "SAB"])
        self.assertEqual(result[0]["trade_date"], previous)
        self.assertEqual(result[0]["close"], 23_100)
        self.assertEqual(result[1]["trade_date"], newest)
        self.assertEqual(result[1]["close"], 46_350)

    def test_keeps_the_newest_record_for_each_symbol(self):
        newest = datetime.date(2026, 7, 16)
        previous = datetime.date(2026, 7, 15)
        db = FakeDatabase({
            newest: [summary_row("ACB.VN", newest, 23_500)],
            previous: [summary_row("ACB.VN", previous, 23_100)],
        })

        result = _fetch_daily_summary(db, newest, max_lookback=2)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["trade_date"], newest)
        self.assertEqual(result[0]["close"], 23_500)

    def test_lookback_counts_trading_days_not_weekends(self):
        monday = datetime.date(2026, 7, 13)
        friday = datetime.date(2026, 7, 10)
        db = FakeDatabase({
            monday: [summary_row("ACB.VN", monday, 23_500)],
            friday: [summary_row("SAB.VN", friday, 46_350)],
        })

        result = _fetch_daily_summary(db, monday, max_lookback=2)

        self.assertEqual([row["symbol"] for row in result], ["ACB", "SAB"])
        self.assertEqual(db.queried_dates, [monday, friday])


if __name__ == "__main__":
    unittest.main()
