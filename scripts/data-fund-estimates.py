#!/usr/bin/env python3
"""Fund estimates (docs/PLAN.md §5a).

Reads the `funds` tab (and the `fund_prices` tab when there is one) and writes `fund_estimates.csv`:

    id,estimate_percent,method,prices_used,first_date,last_date,peers,computed_on,model_version,own_weight,flags

One figure per fund: its estimated median yearly change, in percent, to one decimal. The app only compounds it.

    python scripts/data-fund-estimates.py                                  # fixtures in, src/lib/data/fixtures/fund_estimates.csv out
    python scripts/data-fund-estimates.py --funds URL --prices URL --out fund_estimates.csv
    python scripts/data-fund-estimates.py --report                         # also writes the per-type working to docs/fund-model/
    python scripts/data-fund-estimates.py --backtest                       # walk-forward test on real prices, report in docs/fund-model/
    python scripts/data-fund-estimates.py --simulate                       # the same estimators on simulated funds with a known answer

The model, in one paragraph. Each fund's pace (its yearly log growth) is measured from its own prices (a robust
Huber average of weekly log returns, with a standard error that allows for gaps and for weeks that are not
independent) or, without a price history, from its year-to-date change. A fund's own pace is noisy, so it is pulled
toward the middle of similar funds (same type, same currency) by exactly as much as the noise warrants: the weight
on its own pace is tau^2 / (tau^2 + se^2), where se is how unsure its own pace is and tau is how far the true paces of
similar funds really differ, both measured from the data (empirical Bayes). A quiet fund with a long record keeps
its own pace; a new or volatile one sits near its peers. Prices are cleaned first: a one-week spike that reverts,
an unconfirmed jump in the newest price, a change of price scale and a fund whose price stops moving are all caught.

Install: pip install -r scripts/requirements.txt
"""
from __future__ import annotations

import argparse
import datetime as dt
import math
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "src" / "lib" / "market" / "fixtures"
MODEL_VERSION = "2026.10-b"
OUT_COLUMNS = [
    "id",
    "estimate_percent",
    "method",
    "prices_used",
    "first_date",
    "last_date",
    "peers",
    "computed_on",
    "model_version",
    "own_weight",
    "flags",
]

# Mirrored in src/lib/calc/fund-estimate.ts (the live fallback). Change both together.
MAX_YEARS = 5  # step 1: at most the last 5 years of weekly prices
MAX_GAP_WEEKS = 3  # step 1: a longer gap splits the series
MIN_WEEKS = 52  # step 6: fewer weekly prices than this -> year-to-date method
MIN_PEERS = 10  # step 4: fewer similar funds than this -> no pooling (history) or no figure (ytd)
MIN_YTD_DAYS = 90  # step 6
MIN_SPREAD_FUNDS = 5  # funds with a 30-day change needed to measure how far funds of a type drift apart
HUBER_C = 1.345  # step 3: the usual Huber tuning (95% efficient when returns are normal)
MAD_TO_SD = 1.482602218505602  # MAD of a normal sample x this = its standard deviation

# Price cleaning (step 1).
SPIKE_SIGMAS = 8.0  # a weekly move this many robust standard deviations from zero is suspect...
SPIKE_FLOOR = 0.10  # ...and at least this big (10% in a week)
LEVEL_SHIFT = math.log(5)  # a move of 5x or more that does not revert: a change of scale, not a return
STALE_SHARE = 0.5  # more than half the weeks without any change: the price is not being updated
MIN_IDIO_WEEKS = 26  # weeks shared with peers needed to measure a fund's own (idiosyncratic) noise

# Money market (step 7): a yield far from its peers is used only when the year-to-date change backs it up.
MM_Z = 4.0  # robust z-score against money market funds in the same currency
MM_SD_FLOOR = 0.5  # percentage points; the spread of money market yields is never taken as smaller than this
MM_DISAGREE = 5.0  # percentage points between the 30-day yield and the year-to-date pace

LT_SE = 1.0  # step 4: limited translation, in standard errors of the fund's own pace
EST_BOUNDS = (-90.0, 300.0)  # a figure outside this is a data error, not an estimate

# A year-to-date change that covers only part of the year (the fund started after 1 January).
T30 = 30 / 365
PARTIAL_Z = -3.5  # empirical-null z of "behind its peers before the last 30 days, not during them"
FLAT_PRE = 0.002  # the year-to-date change equals the 30-day change: nothing before the last 30 days

# Step 4, per fund type: "eb" (empirical Bayes weight, the default), "blend" (w = years / (years + k)),
# "own" (no pooling) or "peers" (the peers' middle only). The walk-forward test (--backtest) reports what to set.
METHOD_BY_TYPE: dict[str, str] = {}
# Year-to-date figures pool with the fixed blend: one 30-day cross-section measures the noise too roughly for the
# empirical Bayes weight to beat it (the year-to-date table of --simulate, docs/fund-model/).
YTD_METHOD = "blend"
K_BY_TYPE: dict[str, float] = {"equity": 3.0, "balanced": 3.0, "fixed_income": 3.0, "gold": 3.0, "other": 3.0}


# ---------------------------------------------------------------- reading


def _col(df: pd.DataFrame, name: str, default: str = "") -> pd.Series:
    return df[name].astype(str) if name in df.columns else pd.Series(default, index=df.index, dtype=str)


def _num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.str.replace(",", "").str.replace("%", "").str.strip(), errors="coerce")


def read_funds(src: str) -> pd.DataFrame:
    df = pd.read_csv(src, dtype=str, keep_default_na=False)
    df.columns = [c.strip().lower() for c in df.columns]
    if "id" not in df.columns or "fund_type" not in df.columns:
        raise SystemExit(f"{src}: the funds tab needs at least the columns id and fund_type")
    keep = (_col(df, "active").str.strip().str.upper() == "TRUE") & (
        _col(df, "country", "EG").str.strip().str.upper().replace("", "EG") == "EG"
    )
    df = df[keep].copy()
    df["id"] = df["id"].str.strip()
    df = df[df["id"] != ""].drop_duplicates("id", keep="last")
    df["currency"] = _col(df, "currency", "EGP").str.strip().str.upper().replace("", "EGP")
    df["fund_type"] = df["fund_type"].str.strip().replace("", "other")
    for c in ("price", "change_30d_percent", "change_ytd_percent"):
        df[c] = _num(_col(df, c))
    df["pays_distributions"] = _col(df, "pays_distributions").str.strip().str.upper() == "TRUE"
    price_date = _col(df, "price_date").str.strip()
    df["last_date"] = pd.to_datetime(price_date.where(price_date != "", _col(df, "checked_on")), errors="coerce")
    return df.reset_index(drop=True)


def read_prices(src: str | None) -> pd.DataFrame:
    if not src:
        return pd.DataFrame(columns=["id", "date", "price"])
    df = pd.read_csv(src, dtype=str, keep_default_na=False)
    df.columns = [c.strip().lower() for c in df.columns]
    if not {"id", "date", "price"} <= set(df.columns):
        raise SystemExit(f"{src}: the fund_prices tab needs the columns id, date and price")
    df["id"] = df["id"].str.strip()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["price"] = _num(df["price"])
    df = df.dropna(subset=["date", "price"])
    df = df[np.isfinite(df["price"]) & (df["price"] > 0)]
    return df[["id", "date", "price"]].reset_index(drop=True)


# ---------------------------------------------------------------- robust statistics


def mad_sd(x) -> float:
    """Robust standard deviation: the median absolute deviation, scaled to match a normal sample."""
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if len(x) < 2:
        return float("nan")
    return float(MAD_TO_SD * np.median(np.abs(x - np.median(x))))


def weighted_median(x, w) -> float:
    """The value where half the weight lies on each side; equal weights give the ordinary median."""
    x = np.asarray(x, dtype=float)
    w = np.asarray(w, dtype=float)
    order = np.argsort(x, kind="mergesort")
    x, w = x[order], w[order]
    c = np.cumsum(w)
    half = c[-1] / 2
    i = int(np.searchsorted(c, half - 1e-12 * c[-1]))
    if abs(c[i] - half) <= 1e-12 * c[-1] and i + 1 < len(x):
        return float((x[i] + x[i + 1]) / 2)
    return float(x[i])


def newey_west(g: np.ndarray) -> float:
    """Long-run variance (sum, not mean) of a series of scores, Bartlett kernel, the usual automatic lag."""
    n = len(g)
    lags = int(4 * (n / 100) ** (2 / 9)) if n > 1 else 0
    s = float(g @ g)
    for lag in range(1, min(lags, n - 1) + 1):
        s += 2 * (1 - lag / (lags + 1)) * float(g[lag:] @ g[:-lag])
    return max(s, 0.0)


@dataclass
class Drift:
    rate: float  # mean log change per week
    se: float  # its standard error, per week
    n: int  # returns used


def huber_drift(r: np.ndarray, gaps: np.ndarray | None = None) -> Drift:
    """Step 3: the Huber M-estimate of the weekly drift.

    A return spanning g weeks has g times the drift and g times the variance of a one-week return, so it enters as
    y = r / sqrt(g) = mu * sqrt(g) + noise: a missing week is skipped, never filled, and never counted as one week.
    The standard error is the M-estimator sandwich with a Newey-West long-run variance, so weeks that move
    together (stale pricing, slow-moving markets) do not make the figure look surer than it is.
    """
    r = np.asarray(r, dtype=float)
    g = np.ones_like(r) if gaps is None else np.asarray(gaps, dtype=float)
    n = len(r)
    if n == 0:
        return Drift(float("nan"), float("nan"), 0)
    sq = np.sqrt(g)
    y = r / sq
    plain = float(r.sum() / g.sum())
    if n < 3 or not (mad_sd(y) > 1e-12):
        resid = y - plain * sq
        se = math.sqrt(newey_west(sq * resid)) / g.sum() if n > 1 else float("nan")
        return Drift(plain, se, n)
    fit = sm.RLM(y, sq[:, None], M=sm.robust.norms.HuberT(t=HUBER_C)).fit()
    mu, scale = float(fit.params[0]), float(fit.scale)
    u = (y - mu * sq) / scale
    psi = np.clip(u, -HUBER_C, HUBER_C)
    bread = float(np.sum(g * (np.abs(u) <= HUBER_C)))
    if bread <= 0:
        return Drift(plain, float("nan"), n)
    se = math.sqrt(newey_west(sq * psi * scale)) / bread
    return Drift(mu, se, n)


# ---------------------------------------------------------------- step 1: weekly prices, cleaned


def weekly_series(prices: pd.Series, today: pd.Timestamp) -> pd.Series:
    """The last published price of each week, at most 5 years; missing weeks skipped, a long gap splits."""
    s = prices[~prices.index.duplicated(keep="last")].sort_index()
    s = s[(s.index > today - pd.DateOffset(years=MAX_YEARS)) & (s.index <= today)]
    s = s[np.isfinite(s) & (s > 0)]
    if s.empty:
        return s
    weekly = s.groupby(s.index.to_period("W")).last()
    weekly.index = weekly.index.to_timestamp(how="end").normalize()
    return newest_run(weekly)


def newest_run(weekly: pd.Series) -> pd.Series:
    """Keep the newest run whose weeks are at most MAX_GAP_WEEKS apart."""
    if len(weekly) < 2:
        return weekly
    gaps = weekly.index.to_series().diff().dt.days.fillna(0) / 7
    breaks = np.flatnonzero(gaps.to_numpy() > MAX_GAP_WEEKS + 0.01)
    return weekly.iloc[breaks[-1] if len(breaks) else 0 :]


def week_gaps(weekly: pd.Series) -> np.ndarray:
    return np.maximum(1.0, np.round(np.diff(weekly.index.to_numpy()).astype("timedelta64[D]").astype(float) / 7))


def clean_weekly(weekly: pd.Series) -> tuple[pd.Series, list[str]]:
    """Catches what is a data error rather than a return. Every change is named in the fund's flags."""
    flags: list[str] = []
    w = weekly.copy()
    # A one-week spike that reverts the next week: the spike's price is dropped.
    for _ in range(10):
        if len(w) < 4:
            break
        r = np.diff(np.log(w.to_numpy(dtype=float)))
        thr = max(SPIKE_SIGMAS * (mad_sd(r) or 0.0), SPIKE_FLOOR)
        hit = [
            i + 1
            for i in range(len(r) - 1)
            if abs(r[i]) > thr and r[i] * r[i + 1] < 0 and abs(r[i] + r[i + 1]) < 0.5 * abs(r[i])
        ]
        if not hit:
            break
        w = w.drop(w.index[hit])
        if "spike_removed" not in flags:
            flags.append("spike_removed")
    # A change of scale (a decimal slip, a unit change, a split): only the part after the newest one is kept.
    if len(w) >= 2:
        r = np.diff(np.log(w.to_numpy(dtype=float)))
        shifts = np.flatnonzero(np.abs(r) > LEVEL_SHIFT)
        if len(shifts):
            w = w.iloc[shifts[-1] + 1 :]
            flags.append("level_shift")
    # The newest price jumps and nothing after it confirms it yet: left out until the next week does.
    if len(w) >= 4:
        r = np.diff(np.log(w.to_numpy(dtype=float)))
        thr = max(SPIKE_SIGMAS * (mad_sd(r[:-1]) or 0.0), SPIKE_FLOOR)
        if abs(r[-1]) > thr:
            w = w.iloc[:-1]
            flags.append("last_price_unconfirmed")
    w = newest_run(w)
    if len(w) >= 3:
        r = np.diff(np.log(w.to_numpy(dtype=float)))
        if np.mean(r == 0) > STALE_SHARE:
            flags.append("stale_prices")
    return w, flags


# ---------------------------------------------------------------- steps 2 to 6: a fund's own pace


@dataclass
class Own:
    pace: float  # yearly log pace
    se: float  # how unsure the pace is, relative to its peers (yearly)
    years: float  # how much record stands behind it
    method: str  # history | ytd
    prices_used: int
    first_date: pd.Timestamp | None
    last_date: pd.Timestamp | None
    flags: list[str] = field(default_factory=list)
    returns: pd.Series | None = None  # weekly log returns by week (history only), for the peer comparison
    gaps: np.ndarray | None = None


def history_pace(weekly: pd.Series, flags: list[str]) -> Own:
    """Steps 2 and 3 on a cleaned weekly series."""
    r = np.diff(np.log(weekly.to_numpy(dtype=float)))
    gaps = week_gaps(weekly)
    d = huber_drift(r, gaps)
    return Own(
        pace=d.rate * 52,
        se=d.se * 52,
        years=float(gaps.sum()) / 52,
        method="history",
        prices_used=len(weekly),
        first_date=weekly.index[0],
        last_date=weekly.index[-1],
        flags=list(flags),
        returns=pd.Series(r, index=weekly.index[1:]),
        gaps=gaps,
    )


def ytd_pace(row: pd.Series, today: pd.Timestamp) -> Own | None:
    """Step 6: the year-to-date change as the one long return. Its standard error is set by the fund's group."""
    ytd = row["change_ytd_percent"]
    last = row["last_date"] if pd.notna(row["last_date"]) else today
    start = pd.Timestamp(year=last.year, month=1, day=1)
    days = (last - start).days
    if pd.isna(ytd) or days < MIN_YTD_DAYS or ytd <= -100:
        return None
    return Own(math.log1p(ytd / 100) * 365 / days, float("nan"), days / 365, "ytd", 2, start, last)


def group_spread2(recent: np.ndarray) -> float | None:
    """How far funds of one type drift apart in a year by chance (variance), from the 30-day log changes they all
    published on the same dates. Over 30 days the true differences in pace are tiny next to the noise (the funds'
    own moves, and their different holdings of a market that moved), so the cross-section measures the noise;
    scaled to a year it is the variance of a one-year difference."""
    recent = np.asarray(recent, dtype=float)
    recent = recent[np.isfinite(recent)]
    if len(recent) < MIN_SPREAD_FUNDS:
        return None
    s = mad_sd(recent)
    return s * s / T30 if math.isfinite(s) else None


def ytd_owns(grp: pd.DataFrame, today: pd.Timestamp) -> dict[str, Own]:
    """Step 6 for one group of similar funds (same type and currency): every fund's year-to-date pace and how
    unsure it is.

    A year-to-date change covers the whole year only if the fund existed on 1 January. A fund launched later
    shows a small change that, spread over the full year, reads as a slow fund. It is caught by splitting the
    change in two, before and during the last 30 days, and comparing each part with its peers: a fund that is
    normal in the last 30 days but far behind before them is a partial year. The test statistic is standardised
    against the group's own spread of the statistic (Efron's empirical null), so the fat tails of equity funds
    do not raise false alarms, and a year-to-date change equal to the 30-day change is a partial year outright.
    A partial-year fund is measured on its last 30 days alone (and so pooled hard, since 30 days say little),
    and does not count among the peers or in the measure of noise.
    """
    owns: dict[str, Own] = {}
    recent: dict[str, float] = {}
    for _, row in grp.iterrows():
        c = row["change_30d_percent"]
        if pd.notna(c) and c > -100:
            recent[row["id"]] = math.log1p(c / 100)
        o = ytd_pace(row, today)
        if o is not None:
            owns[row["id"]] = o
    # Log change before the last 30 days, for funds with both figures.
    before = {fid: o.pace * o.years - recent[fid] for fid, o in owns.items() if fid in recent}
    partial = {fid for fid, b in before.items() if abs(b) < FLAT_PRE}
    if len(before) >= MIN_PEERS:
        pre = {fid: b / (owns[fid].years - T30) for fid, b in before.items()}
        rec = {fid: recent[fid] / T30 for fid in before}
        mid_pre, mid_30 = float(np.median(list(pre.values()))), float(np.median(list(rec.values())))
        z = {
            fid: ((pre[fid] - mid_pre) - (rec[fid] - mid_30)) / math.sqrt(1 / (owns[fid].years - T30) + 1 / T30)
            for fid in before
        }
        zc, zs = float(np.median(list(z.values()))), mad_sd(list(z.values()))
        if zs > 0:
            partial |= {fid for fid, v in z.items() if (v - zc) / zs < PARTIAL_Z}
    full = [fid for fid in recent if fid not in partial]
    s2 = group_spread2(np.array([recent[f] for f in full]))
    for fid, o in owns.items():
        if fid in partial:
            o.pace = recent[fid] / T30
            o.years = T30
            o.first_date = o.last_date - pd.Timedelta(days=30)
            o.flags.append("partial_year")
        if s2 is not None:
            o.se = math.sqrt(s2 / o.years)
    return owns


def add_idiosyncratic_se(owns: dict[str, Own], group_of: dict[str, tuple[str, str]]) -> None:
    """For history funds: how unsure each pace is *relative to its peers*.

    Pulling a fund toward its peers only needs to know how far it differs from them, and the weeks every fund of
    a type shares (the market) cancel out of that difference. So the standard error used for pooling comes from
    the fund's return minus the peers' median return of the same week; with too few shared weeks, from the fund's
    own returns.
    """
    by_group: dict[tuple[str, str], list[str]] = {}
    for fid, o in owns.items():
        if o.method == "history" and o.returns is not None:
            by_group.setdefault(group_of[fid], []).append(fid)
    for ids in by_group.values():
        if len(ids) < 4:
            continue
        rates = pd.DataFrame({fid: owns[fid].returns / owns[fid].gaps for fid in ids})
        for fid in ids:
            peers = rates.drop(columns=fid)
            m = peers.median(axis=1).where(peers.notna().sum(axis=1) >= 3)
            o = owns[fid]
            gaps = pd.Series(o.gaps, index=o.returns.index)
            e = (o.returns - gaps * m.reindex(o.returns.index)).dropna()
            if len(e) >= MIN_IDIO_WEEKS:
                d = huber_drift(e.to_numpy(), gaps.reindex(e.index).to_numpy())
                if math.isfinite(d.se):
                    o.se = d.se * 52


# ---------------------------------------------------------------- step 4: pooling with similar funds


@dataclass
class Group:
    center: float  # the middle pace of similar funds (precision-weighted median)
    tau2: float  # how far their true paces differ (variance)
    n: int


def fit_group(paces: np.ndarray, ses: np.ndarray) -> Group | None:
    """Method of moments, robustly: the spread of the measured paces is the spread of the true paces plus the
    measurement noise, so tau^2 = MAD-variance(paces) - median(se^2), never below zero."""
    ok = np.isfinite(paces)
    paces, ses = paces[ok], ses[ok]
    if not np.isfinite(ses).all():  # no measure of noise: plain median, no spread of true paces
        return Group(float(np.median(paces)), 0.0, len(paces)) if len(paces) else None
    n = len(paces)
    if n == 0:
        return None
    spread = mad_sd(paces) if n >= 2 else 0.0
    tau2 = max(0.0, spread * spread - float(np.median(ses**2)))
    denom = tau2 + ses**2
    w = np.where(denom > 0, 1 / np.where(denom > 0, denom, 1), 1e12)
    return Group(weighted_median(paces, w), tau2, n)


def own_weight(o: Own, g: Group, method: str, k: float) -> float:
    if method == "own":
        return 1.0
    if method == "peers":
        return 0.0
    if method == "blend":
        return o.years / (o.years + k)
    denom = g.tau2 + o.se * o.se
    return 1.0 if denom <= 0 else g.tau2 / denom


def pooled(o: Own, g: Group, how: str, k: float) -> tuple[float, float]:
    """Step 4: the pooled pace and the weight on the fund's own pace. With the empirical Bayes weight, the pooled
    pace never moves more than LT_SE standard errors from the fund's own (Efron and Morris's limited
    translation): a fund whose precise record clearly differs from its peers keeps its difference."""
    w = own_weight(o, g, how, k)
    m = w * o.pace + (1 - w) * g.center
    if how == "eb" and math.isfinite(o.se):
        m = min(max(m, o.pace - LT_SE * o.se), o.pace + LT_SE * o.se)
        w = 1.0 if o.pace == g.center else (m - g.center) / (o.pace - g.center)
    return m, w


def to_percent(m: float) -> float:
    """Step 5: the median yearly change."""
    return round((math.exp(m) - 1) * 100, 1)


# ---------------------------------------------------------------- step 7: money market


def money_market_yield(change_30d: float) -> float | None:
    if pd.isna(change_30d) or change_30d <= -100:
        return None
    return round(((1 + change_30d / 100) ** (365 / 30) - 1) * 100, 1)


def ytd_annual_percent(row: pd.Series, today: pd.Timestamp) -> float | None:
    o = ytd_pace(row, today)
    return None if o is None else (math.exp(o.pace) - 1) * 100


def money_market_checked(rows: pd.DataFrame, today: pd.Timestamp) -> dict[str, tuple[float | None, list[str]]]:
    """The 30-day yield of each money market fund; one far from its peers is used only when the fund's own
    year-to-date change backs it up (a broken 30-day figure is far more likely than a money market fund that
    suddenly earns nothing)."""
    out: dict[str, tuple[float | None, list[str]]] = {}
    for _, grp in rows.groupby("currency"):
        ys = {r.id: money_market_yield(r.change_30d_percent) for r in grp.itertuples()}
        vals = np.array([y for y in ys.values() if y is not None], dtype=float)
        mid = float(np.median(vals)) if len(vals) else float("nan")
        sd = max(mad_sd(vals), MM_SD_FLOOR) if len(vals) >= MIN_SPREAD_FUNDS else float("nan")
        for _, row in grp.iterrows():
            y = ys[row["id"]]
            if y is None:
                out[row["id"]] = (None, [])
                continue
            if math.isfinite(sd) and abs(y - mid) / sd > MM_Z:
                backed = ytd_annual_percent(row, today)
                if backed is None or abs(backed - y) > MM_DISAGREE:
                    out[row["id"]] = (None, ["yield_unconfirmed"])
                    continue
            out[row["id"]] = (y, [])
    return out


# ---------------------------------------------------------------- the figure


def estimate(
    funds: pd.DataFrame,
    prices: pd.DataFrame,
    today: pd.Timestamp,
    method_by_type: dict[str, str] | None = None,
) -> pd.DataFrame:
    methods = METHOD_BY_TYPE if method_by_type is None else method_by_type
    by_id = {k: g.set_index("date")["price"] for k, g in prices.groupby("id")} if len(prices) else {}
    group_of = {r.id: (r.fund_type, r.currency) for r in funds.itertuples()}
    owns: dict[str, Own] = {}
    early_flags: dict[str, list[str]] = {}
    no_history: list[int] = []
    for i, row in funds.iterrows():
        fid = row["id"]
        if row["fund_type"] == "money_market":
            continue
        flags: list[str] = []
        if fid in by_id:
            weekly, flags = clean_weekly(weekly_series(by_id[fid], today))
            usable = len(weekly) >= MIN_WEEKS and "stale_prices" not in flags
            if row["pays_distributions"]:
                flags.append("pays_distributions")
            elif usable:
                o = history_pace(weekly, flags)
                if math.isfinite(o.pace):
                    owns[fid] = o
                    continue
        early_flags[fid] = flags
        no_history.append(i)

    add_idiosyncratic_se(owns, group_of)

    for _, grp in funds.loc[no_history].groupby(["fund_type", "currency"]):
        for fid, o in ytd_owns(grp, today).items():
            o.flags = early_flags.pop(fid) + o.flags
            owns[fid] = o

    # The peers: every fund of the same type and currency with a pace, except a partial year.
    groups: dict[tuple[str, str], Group | None] = {}
    members: dict[tuple[str, str], list[str]] = {}
    for fid, o in owns.items():
        if math.isfinite(o.pace) and "partial_year" not in o.flags:
            members.setdefault(group_of[fid], []).append(fid)
    for key, ids in members.items():
        groups[key] = fit_group(np.array([owns[i].pace for i in ids]), np.array([owns[i].se for i in ids]))

    mm = money_market_checked(funds[funds["fund_type"] == "money_market"], today)
    out = []
    computed_on = today.date().isoformat()
    for _, row in funds.iterrows():
        fid = row["id"]
        rec = {c: "" for c in OUT_COLUMNS}
        rec.update(id=fid, computed_on=computed_on, model_version=MODEL_VERSION, peers=0, method="none")
        if row["fund_type"] == "money_market":
            y, flags = mm[fid]
            if y is not None:
                last = row["last_date"] if pd.notna(row["last_date"]) else today
                rec.update(
                    estimate_percent=y,
                    method="yield",
                    prices_used=2,
                    first_date=(last - pd.Timedelta(days=30)).date().isoformat(),
                    last_date=last.date().isoformat(),
                    own_weight=1.0,
                )
            rec["flags"] = ";".join(flags)
            out.append(rec)
            continue
        o = owns.get(fid)
        g = groups.get(group_of[fid])
        peers = len(members.get(group_of[fid], []))
        rec["peers"] = peers
        if o is None:
            rec["flags"] = ";".join(early_flags.get(fid, []))
            out.append(rec)
            continue
        flags = list(o.flags)
        t = row["fund_type"]
        how = methods.get(t, "eb" if o.method == "history" else YTD_METHOD)
        unsure = how == "eb" and not math.isfinite(o.se)
        if o.method == "ytd" and peers < MIN_PEERS:
            flags.append("few_peers")
        elif o.method == "ytd" and unsure:
            flags.append("no_spread")
        else:
            if g is None or peers < MIN_PEERS or unsure:
                w = 1.0
                if peers < MIN_PEERS:
                    flags.append("few_peers")
                m = o.pace
            else:
                m, w = pooled(o, g, how, K_BY_TYPE.get(t, 3.0))
            pct = to_percent(m)
            if not (EST_BOUNDS[0] <= pct <= EST_BOUNDS[1]):
                flags.append("out_of_bounds")
            else:
                rec.update(
                    estimate_percent=pct,
                    method=o.method,
                    prices_used=o.prices_used,
                    first_date=o.first_date.date().isoformat() if o.first_date is not None else "",
                    last_date=o.last_date.date().isoformat() if o.last_date is not None else "",
                    own_weight=round(w, 2),
                )
        rec["flags"] = ";".join(flags)
        out.append(rec)
    return pd.DataFrame(out, columns=OUT_COLUMNS)


def working_report(funds: pd.DataFrame, out: pd.DataFrame, today: pd.Timestamp, path: Path) -> Path:
    """The per-type working behind the figures: what every pooled figure was pulled toward, and by how much."""
    path.parent.mkdir(parents=True, exist_ok=True)
    m = funds[["id", "fund_type", "currency", "change_30d_percent"]].merge(out, on="id")
    m["estimate_percent"] = pd.to_numeric(m["estimate_percent"], errors="coerce")
    m["own_weight"] = pd.to_numeric(m["own_weight"], errors="coerce")
    lines = [
        f"# Fund estimates: the working ({MODEL_VERSION})",
        "",
        f"Computed on {today.date().isoformat()} from {len(funds)} active funds. Regenerate with",
        "`python scripts/data-fund-estimates.py --report`.",
        "",
        "| Type | Currency | Funds | With a figure | Methods | Middle figure | Range | Weight on own pace (median) |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for (t, c), grp in m.groupby(["fund_type", "currency"]):
        got = grp.dropna(subset=["estimate_percent"])
        methods = ", ".join(f"{k} {v}" for k, v in grp["method"].value_counts().sort_index().items())
        mid = f"{got.estimate_percent.median():.1f}%" if len(got) else "—"
        rng = f"{got.estimate_percent.min():.1f}% to {got.estimate_percent.max():.1f}%" if len(got) else "—"
        wt = f"{got.own_weight.median():.2f}" if len(got) else "—"
        lines.append(f"| {t} | {c} | {len(grp)} | {len(got)} | {methods} | {mid} | {rng} | {wt} |")
    flagged = m[m["flags"].astype(str) != ""]
    lines += ["", "## Flags", ""]
    if flagged.empty:
        lines.append("None.")
    else:
        lines += ["| Fund | Type | Currency | Figure | Flags |", "|---|---|---|---|---|"]
        for r in flagged.sort_values(["fund_type", "id"]).itertuples():
            fig = "—" if pd.isna(r.estimate_percent) else f"{r.estimate_percent:.1f}%"
            lines.append(f"| {r.id} | {r.fund_type} | {r.currency} | {fig} | {r.flags} |")
    lines += [
        "",
        "Flags: `yield_unconfirmed` a money market 30-day yield far from its peers that the year-to-date change",
        "does not back up (no figure); `partial_year` the year-to-date change covers only part of the year (the",
        "fund started after 1 January), so the figure uses the last 30 days, pulled hard toward peers; `few_peers` fewer than 10 similar funds; `no_spread` fewer than 5 similar",
        "funds published a 30-day change; `spike_removed`, `level_shift`, `last_price_unconfirmed`, `stale_prices`",
        "price cleaning; `pays_distributions` no history figure until distributions are added back; `out_of_bounds`",
        "a figure outside -90% to +300% (a data error, no figure).",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


# ---------------------------------------------------------------- walk-forward test


CANDIDATES = ["own", "own_mean", "peers", "eb"] + [f"blend_k{k}" for k in (1, 2, 3, 5, 8)] + ["last12m"]


def _price_at(w: pd.Series, when: pd.Timestamp, tolerance_weeks: int = 3) -> tuple[pd.Timestamp, float] | None:
    past = w[(w.index <= when) & (w.index > when - pd.Timedelta(weeks=tolerance_weeks))]
    return None if past.empty else (past.index[-1], float(past.iloc[-1]))


def forecasts_as_of(
    series: dict[str, pd.Series], group_of: dict[str, tuple[str, str]], as_of: pd.Timestamp
) -> dict[str, dict[str, float]]:
    """Every candidate's yearly log pace for every fund with a year of prices before `as_of`."""
    owns: dict[str, Own] = {}
    for fid, w in series.items():
        past = w[w.index <= as_of]
        if len(past) >= MIN_WEEKS:
            owns[fid] = history_pace(past, [])
    add_idiosyncratic_se(owns, group_of)
    members: dict[tuple[str, str], list[str]] = {}
    for fid in owns:
        members.setdefault(group_of[fid], []).append(fid)
    out: dict[str, dict[str, float]] = {}
    for key, ids in members.items():
        g = fit_group(np.array([owns[i].pace for i in ids]), np.array([owns[i].se for i in ids]))
        for fid in ids:
            o = owns[fid]
            past = series[fid][series[fid].index <= as_of]
            pools = g is not None and len(ids) >= MIN_PEERS
            center = g.center if g is not None else o.pace
            preds = {
                "own": o.pace,
                "own_mean": math.log(past.iloc[-1] / past.iloc[0]) / o.years,
                "peers": center,
                "eb": pooled(o, g, "eb", 0)[0] if pools else o.pace,
            }
            for k in (1, 2, 3, 5, 8):
                w = o.years / (o.years + k) if pools else 1.0
                preds[f"blend_k{k}"] = w * o.pace + (1 - w) * center
            year = past[past.index > as_of - pd.DateOffset(years=1)]
            preds["last12m"] = math.log(year.iloc[-1] / year.iloc[0]) * 52 / max(1.0, week_gaps(year).sum()) if len(year) > 1 else o.pace
            out[fid] = preds
    return out


def _bootstrap_diff(err: dict[str, np.ndarray], origin: np.ndarray, a: str, b: str, reps: int, rng) -> tuple[float, float]:
    """90% interval of MdAE(a) - MdAE(b), resampling whole forecast dates (forecasts made on the same date share
    the same market year, so they are not independent)."""
    origins = np.unique(origin)
    idx = {o: np.flatnonzero(origin == o) for o in origins}
    diffs = np.empty(reps)
    for i in range(reps):
        pick = np.concatenate([idx[o] for o in rng.choice(origins, size=len(origins), replace=True)])
        diffs[i] = np.median(err[a][pick]) - np.median(err[b][pick])
    return float(np.quantile(diffs, 0.05)), float(np.quantile(diffs, 0.95))


def backtest(funds: pd.DataFrame, prices: pd.DataFrame, report_dir: Path, today: pd.Timestamp, reps: int = 1000) -> Path:
    """Forecasts made every 13 weeks with only the prices known then, scored against the following year."""
    report_dir.mkdir(parents=True, exist_ok=True)
    path = report_dir / f"backtest-{MODEL_VERSION}.md"
    lines = [f"# Fund estimate walk-forward test ({MODEL_VERSION})", "", f"Run on {today.date().isoformat()}.", ""]
    group_of = {r.id: (r.fund_type, r.currency) for r in funds.itertuples()}
    series: dict[str, pd.Series] = {}
    for fid, g in prices.groupby("id"):
        if fid not in group_of:
            continue
        w, flags = clean_weekly(weekly_series(g.set_index("date")["price"], today))
        if len(w) >= MIN_WEEKS * 2 and "stale_prices" not in flags:
            series[fid] = w
    if not series:
        lines += [
            "No fund has two years of weekly prices yet (`fund_prices` is not back-filled), so no candidate can be",
            "scored on real prices. Every fund ships with the year-to-date method (step 6) or the money market",
            "yield (step 7). `--simulate` scores the same estimators on simulated funds whose answer is known.",
        ]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return path

    start = min(w.index[0] for w in series.values()) + pd.Timedelta(weeks=MIN_WEEKS)
    end = max(w.index[-1] for w in series.values()) - pd.Timedelta(weeks=52)
    rows: list[dict] = []
    for as_of in pd.date_range(start, end, freq="13W"):
        preds = forecasts_as_of(series, group_of, as_of)
        for fid, p in preds.items():
            w = series[fid]
            a = _price_at(w, as_of)
            b = _price_at(w, as_of + pd.Timedelta(weeks=52))
            if a is None or b is None or b[0] <= a[0]:
                continue
            weeks = (b[0] - a[0]).days / 7
            if weeks < 40:
                continue
            actual = ((b[1] / a[1]) ** (52 / weeks) - 1) * 100
            t = group_of[fid][0] if group_of[fid][1] == "EGP" else f"{group_of[fid][0]} ({group_of[fid][1]})"
            for c in CANDIDATES:
                rows.append(dict(origin=as_of, type=t, fund=fid, cand=c, err=(math.exp(p[c]) - 1) * 100 - actual))
    if not rows:
        lines.append("The prices do not yet reach a full year past any forecast date; nothing to score.")
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return path

    df = pd.DataFrame(rows)
    rng = np.random.default_rng(20261014)
    lines += [
        "Forecast every 13 weeks from the prices known on that date; scored against the change over the following",
        "52 weeks. MdAE: median absolute error, in percentage points of the yearly change (lower is better). Bias:",
        "median signed error. The 90% interval is for MdAE(candidate) - MdAE(peers), resampling forecast dates.",
        "",
    ]
    suggest: dict[str, str] = {}
    for t, d in df.groupby("type"):
        wide = d.pivot_table(index=["origin", "fund"], columns="cand", values="err").dropna()
        origin = wide.index.get_level_values("origin").to_numpy()
        err = {c: np.abs(wide[c].to_numpy()) for c in CANDIDATES}
        mdae = {c: float(np.median(err[c])) for c in CANDIDATES}
        bias = {c: float(np.median(wide[c].to_numpy())) for c in CANDIDATES}
        lines += [f"## {t}", "", f"{len(wide)} forecasts, {len(np.unique(origin))} dates, {wide.index.get_level_values('fund').nunique()} funds.", ""]
        lines += ["| Candidate | MdAE | Bias | vs peers (90%) |", "|---|---|---|---|"]
        ci = {}
        for c in CANDIDATES:
            ci[c] = (0.0, 0.0) if c == "peers" else _bootstrap_diff(err, origin, c, "peers", reps, rng)
            lines.append(f"| {c} | {mdae[c]:.1f} | {bias[c]:+.1f} | {ci[c][0]:+.1f} to {ci[c][1]:+.1f} |")
        best = min(mdae, key=mdae.get)
        ships = best if best == "peers" or ci[best][1] < 0 else "peers"
        lines += ["", f"Ships: **{ships}** (lowest MdAE: {best}).", ""]
        if "(" not in t:
            suggest[t] = ships
    lines += ["## What to set", "", "```python"]
    for t, s in sorted(suggest.items()):
        if s.startswith("blend_k"):
            lines.append(f'METHOD_BY_TYPE["{t}"] = "blend"; K_BY_TYPE["{t}"] = {float(s[7:])}')
        elif s in ("own_mean", "last12m"):
            lines.append(f"# {t}: {s} won; not a shipping method yet, keep eb and review")
        else:
            lines.append(f'METHOD_BY_TYPE["{t}"] = "{s}"')
    lines += ["```", ""]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


# ---------------------------------------------------------------- simulation study


SIM_TYPES = {
    # type: (true middle yearly change, spread of true paces, weekly market sd, weekly own sd)
    "equity": (0.20, 0.06, 0.030, 0.020),
    "balanced": (0.18, 0.04, 0.015, 0.012),
    "fixed_income": (0.17, 0.015, 0.0025, 0.002),
}


def simulate_panel(rng, n_funds: int = 30, weeks: int = 260, end: str = "2026-10-09", glitches: bool = True):
    """Weekly prices for funds whose true pace is known: a market move every fund of a type shares, the fund's own
    move (both fat-tailed, Student t with 4 degrees of freedom), funds of different ages, missing weeks, spikes."""
    dates = pd.date_range(end=end, periods=weeks, freq="W-FRI")
    rows, truth, funds = [], {}, []
    tdist = lambda size: rng.standard_t(4, size) / math.sqrt(2)  # unit variance  # noqa: E731
    for t, (mid, tau, sm_, si) in SIM_TYPES.items():
        market = sm_ * tdist(weeks)
        for i in range(n_funds):
            fid = f"{t}-{i}"
            pace = math.log1p(mid) + tau * rng.standard_normal()
            truth[fid] = pace
            r = pace / 52 + market + si * tdist(weeks)
            p = 10 * np.exp(np.cumsum(r))
            born = int(rng.integers(0, weeks - 60)) if rng.random() < 0.5 else 0
            keep = np.arange(born, weeks)
            if glitches:
                keep = keep[rng.random(len(keep)) > 0.03]  # 3% of weeks not published
                if rng.random() < 0.1:
                    j = int(rng.integers(len(keep) // 4, len(keep) - 2))
                    p = p.copy()
                    p[keep[j]] *= rng.choice([0.5, 1.6, 10.0])  # a one-week spike or a slipped decimal
            rows.append(pd.DataFrame({"id": fid, "date": dates[keep], "price": p[keep]}))
            funds.append({"id": fid, "fund_type": t, "currency": "EGP"})
    return pd.DataFrame(funds), pd.concat(rows, ignore_index=True), truth


def simulate(report_dir: Path | None = None, reps: int = 40, seed: int = 20261014, n_funds: int = 30) -> tuple[pd.DataFrame, Path | None]:
    """Each estimator's error against the true pace, over many simulated markets."""
    rng = np.random.default_rng(seed)
    errs: list[dict] = []
    for rep in range(reps):
        funds, prices, truth = simulate_panel(rng, n_funds=n_funds)
        today = prices["date"].max()
        group_of = {r.id: (r.fund_type, r.currency) for r in funds.itertuples()}
        series = {}
        for fid, g in prices.groupby("id"):
            w, flags = clean_weekly(weekly_series(g.set_index("date")["price"], today))
            if "stale_prices" not in flags:
                series[fid] = w
        for fid, p in forecasts_as_of(series, group_of, today).items():
            true = (math.exp(truth[fid]) - 1) * 100
            for c in CANDIDATES:
                errs.append(dict(rep=rep, type=group_of[fid][0], cand=c, abs_err=abs((math.exp(p[c]) - 1) * 100 - true)))
    df = pd.DataFrame(errs)
    table = df.groupby(["type", "cand"])["abs_err"].mean().unstack("cand")[CANDIDATES]
    path = None
    if report_dir is not None:
        report_dir.mkdir(parents=True, exist_ok=True)
        path = report_dir / f"simulation-{MODEL_VERSION}.md"
        lines = [
            f"# Fund estimate simulation study ({MODEL_VERSION})",
            "",
            f"{reps} simulated markets, {n_funds} funds per type, up to 5 years of weekly prices (half the funds",
            "younger, 3% of weeks missing, 10% of funds with a spike or slipped decimal). Returns are fat-tailed",
            "(Student t, 4 degrees of freedom): a market move every fund of a type shares plus the fund's own.",
            "Each fund's true yearly change is known; the table is the mean absolute error of each estimator",
            "against it, in percentage points (lower is better). `eb` ships for history figures: it is the only",
            "rule close to the best for every type, where a fixed k suits one type and not another.",
            "",
            "| Type | " + " | ".join(CANDIDATES) + " |",
            "|---" * (len(CANDIDATES) + 1) + "|",
        ]
        for t, r in table.iterrows():
            best = r.idxmin()
            lines.append(f"| {t} | " + " | ".join(("**%.2f**" if c == best else "%.2f") % r[c] for c in CANDIDATES) + " |")
        lines += [
            "",
            "Settings per type (true middle change, spread of true paces, weekly market sd, weekly own sd): "
            + "; ".join(f"{t} {m:.0%}, {tau:.3f}, {a:.4f}, {b:.4f}" for t, (m, tau, a, b) in SIM_TYPES.items())
            + ".",
            "",
        ]
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return table, path


SIM_YTD_TYPES = {
    # type: (pace without the market, expected market pace, market yearly sd, mean exposure, sd of exposure,
    #        sd of the funds' own true paces, own yearly sd)
    "equity": (0.00, 0.20, 0.25, 1.0, 0.15, 0.04, 0.10),
    "balanced": (0.12, 0.20, 0.25, 0.4, 0.20, 0.02, 0.05),
    "fixed_income": (0.16, 0.00, 0.03, 1.0, 0.30, 0.015, 0.01),
}
YTD_CANDIDATES = ["own", "peers", "old_k3", "blend_k3", "eb"]


def simulate_ytd_panel(rng, n_funds: int = 30, today: str = "2026-10-13", late_share: float = 0.1):
    """Published year-to-date and 30-day changes for funds whose true pace is known. Funds hold different amounts
    of their market (so a month the market moved spreads them apart), and some started after 1 January."""
    today_ts = pd.Timestamp(today)
    days = (today_ts - pd.Timestamp(year=today_ts.year, month=1, day=1)).days
    dt_ = 1 / 365
    rows, truth = [], {}
    for t, (base, mu_m, sd_m, b_mid, b_sd, tau, sd_own) in SIM_YTD_TYPES.items():
        market = mu_m * dt_ + sd_m * math.sqrt(dt_) * rng.standard_t(4, days) / math.sqrt(2)
        for i in range(n_funds):
            fid = f"{t}-{i}"
            beta = b_mid + b_sd * rng.standard_normal()
            alpha = tau * rng.standard_normal()
            truth[fid] = base + alpha + beta * mu_m
            r = (base + alpha) * dt_ + beta * market + sd_own * math.sqrt(dt_) * rng.standard_t(4, days) / math.sqrt(2)
            born = int(rng.integers(30, days - 5)) if rng.random() < late_share else 0
            ytd = math.expm1(r[born:].sum()) * 100
            c30 = math.expm1(r[max(born, days - 30) :].sum()) * 100
            rows.append(dict(id=fid, fund_type=t, currency="EGP", change_30d_percent=round(c30, 2),
                             change_ytd_percent=round(ytd, 2), pays_distributions=False, last_date=today_ts))
    return pd.DataFrame(rows), truth, today_ts


def simulate_ytd(reps: int = 200, seed: int = 20261014, n_funds: int = 30) -> pd.DataFrame:
    """Every year-to-date candidate's mean absolute error against the true pace, in percentage points."""
    rng = np.random.default_rng(seed)
    errs: list[dict] = []
    empty = pd.DataFrame(columns=["id", "date", "price"])
    for rep in range(reps):
        funds, truth, today = simulate_ytd_panel(rng, n_funds=n_funds)
        types = list(SIM_YTD_TYPES)
        runs = {
            "own": estimate(funds, empty, today, {t: "own" for t in types}),
            "peers": estimate(funds, empty, today, {t: "peers" for t in types}),
            "blend_k3": estimate(funds, empty, today, {t: "blend" for t in types}),
            "eb": estimate(funds, empty, today, {t: "eb" for t in types}),
        }
        # The method before 2026.10-b: w = years / (years + 3) toward the plain median, no partial-year test.
        days = (today - pd.Timestamp(year=today.year, month=1, day=1)).days
        pace = np.log1p(funds["change_ytd_percent"].to_numpy() / 100) * 365 / days
        w = (days / 365) / (days / 365 + 3)
        old = {}
        for t in types:
            m = (funds["fund_type"] == t).to_numpy()
            old.update(zip(funds["id"][m], w * pace[m] + (1 - w) * np.median(pace[m])))
        for fid, true in truth.items():
            t = fid.rsplit("-", 1)[0]
            true_pct = math.expm1(true) * 100
            errs.append(dict(type=t, cand="old_k3", abs_err=abs(math.expm1(old[fid]) * 100 - true_pct)))
            for c, out in runs.items():
                v = out.loc[out["id"] == fid, "estimate_percent"].iloc[0]
                if v != "" and pd.notna(v):
                    errs.append(dict(type=t, cand=c, abs_err=abs(float(v) - true_pct)))
    return pd.DataFrame(errs).groupby(["type", "cand"])["abs_err"].mean().unstack("cand")[YTD_CANDIDATES]


# ---------------------------------------------------------------- main


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--funds", default=str(FIXTURES / "funds.csv"))
    p.add_argument(
        "--prices",
        default=os.environ.get("FUND_PRICES_URL"),
        help="fund_prices CSV (file or URL), e.g. the published fund_prices tab; optional",
    )
    p.add_argument("--out", default=str(FIXTURES / "fund_estimates.csv"))
    p.add_argument("--today", default=None, help="YYYY-MM-DD; defaults to the newest date in the funds tab")
    p.add_argument("--report", action="store_true", help="also write the per-type working to --report-dir")
    p.add_argument("--backtest", action="store_true")
    p.add_argument("--simulate", action="store_true")
    p.add_argument("--report-dir", default=str(ROOT / "docs" / "fund-model"))
    a = p.parse_args(argv)

    if a.simulate:
        table, path = simulate(Path(a.report_dir))
        ytd = simulate_ytd(reps=100)
        lines = [
            "## Year-to-date figures",
            "",
            "100 simulated years, 30 funds per type, one year-to-date and one 30-day change each (10% of funds",
            "started after 1 January; funds hold different amounts of a fat-tailed market). Mean absolute error",
            "against the true yearly change, percentage points. `old_k3` is the method before 2026.10-b (no",
            "partial-year test); `blend_k3` adds the test; `eb` uses the empirical Bayes weight. Ships: "
            f"`{YTD_METHOD}`.",
            "",
            "| Type | " + " | ".join(YTD_CANDIDATES) + " |",
            "|---" * (len(YTD_CANDIDATES) + 1) + "|",
        ]
        for t, r in ytd.iterrows():
            lines.append(f"| {t} | " + " | ".join(f"{r[c]:.2f}" for c in YTD_CANDIDATES) + " |")
        with open(path, "a", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
        print(table.round(2).to_string())
        print(ytd.round(2).to_string())
        print(f"report: {path}")
        return 0

    funds = read_funds(a.funds)
    prices = read_prices(a.prices)
    if a.today:
        today = pd.Timestamp(a.today)
    elif funds["last_date"].notna().any():
        today = funds["last_date"].max()
    else:
        today = pd.Timestamp(dt.date.today())

    if a.backtest:
        print(f"report: {backtest(funds, prices, Path(a.report_dir), today)}")
        return 0

    out = estimate(funds, prices, today)
    bad = pd.to_numeric(out["estimate_percent"], errors="coerce")
    assert not ((out["method"] != "none") & ~np.isfinite(bad)).any(), "a figure without a number"
    out.to_csv(a.out, index=False)
    counts = out["method"].value_counts().to_dict()
    flagged = int((out["flags"] != "").sum())
    print(f"{len(out)} funds -> {a.out} " + " ".join(f"{k}={v}" for k, v in sorted(counts.items())) + f" flagged={flagged}")
    if a.report:
        print(f"report: {working_report(funds, out, today, Path(a.report_dir) / f'estimates-{MODEL_VERSION}.md')}")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
