"""pytest scripts/tests -q   (synthetic series with a known pace)"""
import importlib.util
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

spec = importlib.util.spec_from_file_location("fe", Path(__file__).resolve().parent.parent / "data-fund-estimates.py")
fe = importlib.util.module_from_spec(spec)
sys.modules["fe"] = fe
spec.loader.exec_module(fe)

TODAY = pd.Timestamp("2026-10-13")


def funds_frame(rows):
    base = dict(currency="EGP", change_30d_percent=np.nan, change_ytd_percent=np.nan, pays_distributions=False, last_date=TODAY)
    return pd.DataFrame([{**base, **r} for r in rows])


def series(weeks, pace, start="2023-10-16", noise=0.0, seed=1):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start, periods=weeks, freq="W-FRI")
    r = pace / 52 + rng.normal(0, noise, weeks)
    return pd.Series(100 * np.exp(np.cumsum(r)), index=dates)


def prices_frame(by_id):
    return pd.concat([pd.DataFrame({"id": k, "date": s.index, "price": s.values}) for k, s in by_id.items()])


def test_known_pace_is_recovered():
    s = series(156, math.log(1.2))
    est = fe.estimate(funds_frame([{"id": "a", "fund_type": "equity"}]), prices_frame({"a": s}), TODAY)
    row = est.iloc[0]
    assert row.method == "history"
    assert row.estimate_percent == pytest.approx(20.0, abs=0.2)
    assert row.peers == 1  # fewer than 10 peers: no blend


def test_freak_week_does_not_move_the_figure():
    s = series(156, math.log(1.2), noise=0.002)
    freak = s.copy()
    freak.iloc[80:] *= 1.5  # one week jumps 50%
    a = fe.estimate(funds_frame([{"id": "a", "fund_type": "equity"}]), prices_frame({"a": s}), TODAY).iloc[0]
    b = fe.estimate(funds_frame([{"id": "a", "fund_type": "equity"}]), prices_frame({"a": freak}), TODAY).iloc[0]
    assert abs(a.estimate_percent - b.estimate_percent) < 3


def test_long_gap_splits_the_series_and_keeps_the_newest_part():
    s = series(156, math.log(1.2))
    gapped = pd.concat([s.iloc[:40], s.iloc[60:]])
    w = fe.weekly_series(gapped, TODAY)
    assert w.index[0] == s.index[60].normalize() or w.index[0] >= s.index[59]
    assert len(w) == 96


def test_missing_weeks_are_skipped_not_filled():
    s = series(156, math.log(1.2)).drop(series(156, 0).index[[10, 30, 50]])
    w = fe.weekly_series(s, TODAY)
    assert len(w) == 153


def test_fewer_than_ten_peers_means_no_blend_and_ytd_needs_peers():
    rows = [{"id": f"f{i}", "fund_type": "equity", "change_ytd_percent": 30.0} for i in range(5)]
    est = fe.estimate(funds_frame(rows), prices_frame({"x": series(2, 0)}), TODAY)
    assert set(est.method) == {"none"}


def test_ytd_method_with_enough_peers_pulls_toward_the_middle():
    rows = [{"id": f"f{i}", "fund_type": "equity", "change_ytd_percent": 20.0} for i in range(10)]
    rows.append({"id": "odd", "fund_type": "equity", "change_ytd_percent": 60.0})
    est = fe.estimate(funds_frame(rows), prices_frame({"x": series(2, 0)}), TODAY).set_index("id")
    assert est.loc["odd", "method"] == "ytd"
    own = (math.exp(math.log(1.6) * 365 / 285) - 1) * 100
    peers = (math.exp(math.log(1.2) * 365 / 285) - 1) * 100
    assert peers < est.loc["odd", "estimate_percent"] < own
    assert est.loc["odd", "peers"] == 11


def test_under_ninety_days_into_the_year_gives_no_figure():
    early = pd.Timestamp("2026-02-15")
    rows = [{"id": f"f{i}", "fund_type": "equity", "change_ytd_percent": 5.0, "last_date": early} for i in range(12)]
    est = fe.estimate(funds_frame(rows), prices_frame({"x": series(2, 0)}), early)
    assert set(est.method) == {"none"}


def test_money_market_uses_the_current_yield():
    est = fe.estimate(funds_frame([{"id": "mm", "fund_type": "money_market", "change_30d_percent": 1.4}]), prices_frame({"x": series(2, 0)}), TODAY)
    assert est.iloc[0].method == "yield"
    assert est.iloc[0].estimate_percent == pytest.approx(((1.014) ** (365 / 30) - 1) * 100, abs=0.05)


def test_other_currency_is_never_a_peer():
    rows = [{"id": f"e{i}", "fund_type": "equity", "change_ytd_percent": 20.0} for i in range(10)]
    rows.append({"id": "usd", "fund_type": "equity", "currency": "USD", "change_ytd_percent": 5.0})
    est = fe.estimate(funds_frame(rows), prices_frame({"x": series(2, 0)}), TODAY).set_index("id")
    assert est.loc["usd", "peers"] == 1
    assert est.loc["usd", "method"] == "none"


def test_distribution_funds_get_no_history_figure():
    s = series(156, math.log(1.2))
    est = fe.estimate(
        funds_frame([{"id": "a", "fund_type": "equity", "pays_distributions": True}]), prices_frame({"a": s}), TODAY
    )
    assert est.iloc[0].method != "history"


def test_backtest_writes_a_report(tmp_path):
    by_id = {f"f{i}": series(200, math.log(1.1 + i / 100), start="2022-10-01", noise=0.01, seed=i) for i in range(12)}
    funds = funds_frame([{"id": k, "fund_type": "equity"} for k in by_id])
    path = fe.backtest(funds, prices_frame(by_id), tmp_path, TODAY)
    text = path.read_text()
    assert "## equity" in text
    assert "Ships:" in text


# ---------------------------------------------------------------- 2026.10-b


def test_huber_drift_handles_gaps_as_multi_week_returns():
    s = series(156, math.log(1.2))
    gapped = s.drop(s.index[1::3])  # every third week missing: many two-week returns
    w = fe.weekly_series(gapped, TODAY)
    r = np.diff(np.log(w.to_numpy()))
    d = fe.huber_drift(r, fe.week_gaps(w))
    assert d.rate * 52 == pytest.approx(math.log(1.2), abs=0.005)


def test_standard_error_grows_with_autocorrelation():
    rng = np.random.default_rng(3)
    e = rng.normal(0, 0.01, 400)
    iid = fe.huber_drift(e)
    smooth = fe.huber_drift(np.convolve(e, np.ones(4) / 2, mode="same"))  # stale pricing: neighbours move together
    assert smooth.se > 1.3 * iid.se


def test_spike_that_reverts_is_removed():
    s = series(120, math.log(1.2), noise=0.004)
    bad = s.copy()
    bad.iloc[60] *= 1.8
    w, flags = fe.clean_weekly(fe.weekly_series(bad, TODAY))
    assert "spike_removed" in flags
    assert len(w) == 119


def test_decimal_slip_keeps_the_newer_part():
    s = series(150, math.log(1.2), noise=0.004)
    slipped = s.copy()
    slipped.iloc[:40] /= 10
    w, flags = fe.clean_weekly(fe.weekly_series(slipped, TODAY))
    assert "level_shift" in flags
    assert len(w) == 110


def test_unconfirmed_last_price_is_held_back():
    s = series(120, math.log(1.2), noise=0.004)
    s.iloc[-1] *= 1.5
    w, flags = fe.clean_weekly(fe.weekly_series(s, TODAY))
    assert "last_price_unconfirmed" in flags and len(w) == 119


def test_frozen_price_gets_no_history_figure():
    s = series(120, 0)  # never moves
    est = fe.estimate(funds_frame([{"id": "a", "fund_type": "equity"}]), prices_frame({"a": s}), TODAY).iloc[0]
    assert est.method != "history"
    assert "stale_prices" in est["flags"]


def test_empirical_bayes_keeps_a_quiet_long_record_and_pools_a_noisy_one():
    by_id = {f"p{i}": series(260, math.log(1.15), start="2021-10-15", noise=0.01, seed=i) for i in range(10)}
    by_id["quiet"] = series(260, math.log(1.25), start="2021-10-15", noise=0.001, seed=50)
    by_id["noisy"] = series(60, math.log(1.25), start="2025-08-15", noise=0.03, seed=51)
    funds = funds_frame([{"id": k, "fund_type": "equity"} for k in by_id])
    est = fe.estimate(funds, prices_frame(by_id), TODAY).set_index("id")
    assert est.loc["quiet", "own_weight"] > est.loc["noisy", "own_weight"]
    assert est.loc["quiet", "estimate_percent"] > est.loc["noisy", "estimate_percent"]


def test_late_launch_is_caught_and_not_read_as_a_slow_fund():
    rows = [
        {"id": f"f{i}", "fund_type": "fixed_income", "change_ytd_percent": 13.0 + i / 10, "change_30d_percent": 1.3 + i / 100}
        for i in range(12)
    ]
    rows.append({"id": "new", "fund_type": "fixed_income", "change_ytd_percent": 2.0, "change_30d_percent": 1.7})
    rows.append({"id": "newer", "fund_type": "fixed_income", "change_ytd_percent": 0.9, "change_30d_percent": 0.9})
    est = fe.estimate(funds_frame(rows), prices_frame({"x": series(2, 0)}), TODAY).set_index("id")
    for fid in ("new", "newer"):
        assert "partial_year" in est.loc[fid, "flags"]
        assert est.loc[fid, "estimate_percent"] > 14  # near its peers, not the 2% a whole-year reading gives
    assert est.loc["f0", "flags"] == "" or pd.isna(est.loc["f0", "flags"])
    assert est.loc["f0", "peers"] == 12  # the partial years are not peers


def test_broken_money_market_yield_is_not_published():
    rows = [
        {"id": f"m{i}", "fund_type": "money_market", "change_30d_percent": 1.35 + i / 100, "change_ytd_percent": 14.5}
        for i in range(10)
    ]
    rows.append({"id": "broken", "fund_type": "money_market", "change_30d_percent": -0.11, "change_ytd_percent": 5.3})
    rows.append({"id": "backed", "fund_type": "money_market", "change_30d_percent": 0.9, "change_ytd_percent": 9.6})
    est = fe.estimate(funds_frame(rows), prices_frame({"x": series(2, 0)}), TODAY).set_index("id")
    assert est.loc["broken", "method"] == "none" and est.loc["broken", "flags"] == "yield_unconfirmed"
    assert est.loc["backed", "method"] == "yield"  # far from peers, but its year-to-date agrees


def test_history_simulation_eb_beats_no_pooling():
    table, _ = fe.simulate(None, reps=6, n_funds=20)
    assert table["eb"].mean() < table["own"].mean()
    assert table["eb"].mean() < table["last12m"].mean()
