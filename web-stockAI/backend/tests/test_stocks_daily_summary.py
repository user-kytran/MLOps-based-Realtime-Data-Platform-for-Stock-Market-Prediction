import datetime
import unittest
from types import SimpleNamespace

from src.api.routers.stocks import _fetch_daily_summary, get_vietnam_market_status


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


class MarketStatusTests(unittest.TestCase):
    def test_weekend_status(self):
        # 2026-08-30 is Sunday
        dt = datetime.datetime(2026, 8, 30, 10, 0, 0)
        status = get_vietnam_market_status(dt)
        self.assertFalse(status["is_open"])
        self.assertFalse(status["is_trading_day"])
        self.assertEqual(status["status_code"], "CLOSED_WEEKEND")

    def test_holiday_status(self):
        # 2026-09-02 is VN National Day
        dt = datetime.datetime(2026, 9, 2, 10, 0, 0)
        status = get_vietnam_market_status(dt)
        self.assertFalse(status["is_open"])
        self.assertFalse(status["is_trading_day"])
        self.assertEqual(status["status_code"], "CLOSED_HOLIDAY")

    def test_continuous_trading_morning(self):
        # 2026-09-03 is Thursday (Trading day), 10:15 AM
        dt = datetime.datetime(2026, 9, 3, 10, 15, 0)
        status = get_vietnam_market_status(dt)
        self.assertTrue(status["is_open"])
        self.assertTrue(status["is_trading_day"])
        self.assertEqual(status["status_code"], "CONTINUOUS_MORNING")

    def test_lunch_break(self):
        # 2026-09-03 is Thursday, 12:00 PM (Lunch break)
        dt = datetime.datetime(2026, 9, 3, 12, 0, 0)
        status = get_vietnam_market_status(dt)
        self.assertFalse(status["is_open"])
        self.assertTrue(status["is_trading_day"])
        self.assertEqual(status["status_code"], "LUNCH_BREAK")

    def test_atc_session(self):
        # 2026-09-03 is Thursday, 14:35 PM (ATC)
        dt = datetime.datetime(2026, 9, 3, 14, 35, 0)
        status = get_vietnam_market_status(dt)
        self.assertTrue(status["is_open"])
        self.assertTrue(status["is_trading_day"])
        self.assertEqual(status["status_code"], "ATC")


if __name__ == "__main__":
    unittest.main()
