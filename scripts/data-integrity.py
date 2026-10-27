"""Integrity check of the scraped data (the sheet's tabs).

Reads the four tabs from a folder of CSVs (default: src/lib/data/fixtures) or from the published sheet
(--sheet, uses SHEET_CSV_BASE + the tab gids), and writes a plain report of rows that look wrong.
It never changes the data; every finding names the row id so it can be fixed in the scraper or the sheet.

    python3 scripts/data-integrity.py                 # the saved copy
    python3 scripts/data-integrity.py --sheet         # the live sheet
    python3 scripts/data-integrity.py --out report.md
"""

from __future__ import annotations

import argparse
import io
import os
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "src" / "lib" / "market" / "fixtures"
DEFAULT_SHEET_BASE = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRXmD2AKuwo9gMXiaJF3clZws0msaOmTEiFWhVd_8mxQg5wmXw6NDk9uB-"
    "azPwxAL0OfbsaIubwVH6l/pub?single=true&output=csv&gid="
)
TABS = ["offers", "funds", "banks", "managers"]

ARABIC = re.compile(r"[؀-ۿ]")
# A 30-day move bigger than this, by fund type, is very unlikely for a real fund (percent).
MAX_30D = {"money_market": 4, "fixed_income": 8, "balanced": 15, "equity": 30, "gold": 25, "other": 30}
# Year-to-date bounds by type (percent).
MAX_YTD = {"money_market": 30, "fixed_income": 40, "balanced": 80, "equity": 150, "gold": 120, "other": 150}
RATE_RANGE = (5.0, 40.0)  # certificate and bill rates in Egypt, percent a year
STALE_DAYS = {"fund": 7, "offer": 30}


def read_tabs(sheet: bool) -> dict[str, pd.DataFrame]:
    out = {}
    if sheet:
        from importlib import util  # noqa: F401  (kept simple: gids come from the app's data module)

        src = (ROOT / "src" / "lib" / "data" / "index.ts").read_text()
        base = os.environ.get("SHEET_CSV_BASE", DEFAULT_SHEET_BASE)
        for tab in TABS:
            m = re.search(rf"{tab}:\s*'?(\d+)'?", src)
            if not m:
                continue
            with urllib.request.urlopen(base + m.group(1), timeout=30) as r:
                out[tab] = pd.read_csv(io.StringIO(r.read().decode("utf-8")), dtype=str).fillna("")
    else:
        for tab in TABS:
            p = FIXTURES / f"{tab}.csv"
            if p.exists():
                out[tab] = pd.read_csv(p, dtype=str).fillna("")
    return out


def num(v: str) -> float | None:
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def days_old(d: str, today: date) -> int | None:
    try:
        return (today - date.fromisoformat(d.strip()[:10])).days
    except ValueError:
        return None


class Report:
    def __init__(self) -> None:
        self.sections: dict[str, list[str]] = {}

    def add(self, section: str, line: str) -> None:
        self.sections.setdefault(section, []).append(line)

    def render(self, header: list[str]) -> str:
        lines = header[:]
        for name, rows in self.sections.items():
            lines += ["", f"## {name} ({len(rows)})", ""]
            lines += [f"- {r}" for r in rows[:60]]
            if len(rows) > 60:
                lines.append(f"- … and {len(rows) - 60} more")
        if not self.sections:
            lines += ["", "No problems found."]
        return "\n".join(lines) + "\n"


def check_funds(df: pd.DataFrame, rep: Report, today: date, managers: pd.DataFrame | None) -> dict:
    active = df[df["active"].str.upper() == "TRUE"]
    s = "Funds"
    for col in ["id", "fund_en", "fund_ar", "manager_en", "fund_type", "currency", "price", "source_url", "checked_on"]:
        if col not in df.columns:
            rep.add(f"{s}: missing columns", col)
    dup = active[active["id"].duplicated(keep=False)]
    for i in sorted(set(dup["id"])):
        rep.add(f"{s}: duplicate ids", i)
    key = active["fund_ar"].str.strip() + "|" + active["manager_en"].str.strip()
    for k in sorted(set(key[key.duplicated(keep=False)])):
        rep.add(f"{s}: same fund listed twice (name + manager)", k.replace("|", " — "))
    # What similar funds did over the same 30 days: a fund far away from its type's middle is worth a look.
    c30_all = pd.to_numeric(active["change_30d_percent"].str.replace(",", ""), errors="coerce")
    middle = {}
    for (t, cur), g in c30_all.groupby([active["fund_type"], active["currency"]]):
        g = g.dropna()
        if len(g) >= 5:
            mad = float((g - g.median()).abs().median()) or 0.5
            middle[(t, cur)] = (float(g.median()), mad)
    for _, r in active.iterrows():
        rid, t = r["id"], (r["fund_type"] or "other")
        c = num(r.get("change_30d_percent", ""))
        mm = middle.get((r["fund_type"], r["currency"]))
        if c is not None and mm and abs(c - mm[0]) > max(5 * mm[1], 5):
            rep.add(
                f"{s}: 30-day change far from similar funds",
                f"{rid} ({t}) {r['fund_en'][:40]}: {c:+.2f}% vs {mm[0]:+.2f}% for most {t} funds",
            )
        if ARABIC.search(r["fund_en"]):
            rep.add(f"{s}: English name is in Arabic", f"{rid}: {r['fund_en']}")
        if not r["fund_en"].strip() and not r["fund_ar"].strip():
            rep.add(f"{s}: no name", rid)
        p = num(r["price"])
        if p is None or p <= 0:
            rep.add(f"{s}: price missing or not positive", f"{rid}: {r['price']!r}")
        c30, ytd = num(r.get("change_30d_percent", "")), num(r.get("change_ytd_percent", ""))
        if c30 is not None and abs(c30) > MAX_30D.get(t, 30):
            rep.add(f"{s}: 30-day change too large for its type", f"{rid} ({t}) {r['fund_en'][:40]}: {c30:+.2f}% in 30 days")
        if ytd is not None and (ytd > MAX_YTD.get(t, 150) or ytd < -60):
            rep.add(f"{s}: this-year change out of range", f"{rid} ({t}) {r['fund_en'][:40]}: {ytd:+.2f}% this year")
        if c30 is not None and ytd is not None and today.month >= 3 and c30 > 5 and c30 > ytd + 1:
            rep.add(f"{s}: 30-day gain bigger than the whole year's", f"{rid} {r['fund_en'][:40]}: 30d {c30:+.2f}% vs year {ytd:+.2f}%")
        if c30 is None:
            rep.add(f"{s}: no 30-day change", rid)
        if ytd is None:
            rep.add(f"{s}: no this-year change", rid)
        if t in ("equity", "gold") and r.get("risk", "").lower() == "low":
            rep.add(f"{s}: share/gold fund labelled low risk", f"{rid} {r['fund_en'][:40]}")
        if t == "money_market" and r.get("risk", "").lower() == "high":
            rep.add(f"{s}: money-market fund labelled high risk", f"{rid} {r['fund_en'][:40]}")
        name = (r["fund_en"] + " " + r["fund_ar"]).lower()
        if t == "money_market" and re.search(r"equity|أسهم", name):
            rep.add(f"{s}: type says money market but the name says shares", f"{rid} {r['fund_en'][:50]}")
        if t == "equity" and re.search(r"money market|نقدي", name):
            rep.add(f"{s}: type says shares but the name says money market", f"{rid} {r['fund_en'][:50]}")
        if t != "gold" and re.search(r"\bgold\b|(^|\s)(ال)?ذهب", name):
            rep.add(f"{s}: name says gold but type is {t}", f"{rid} {r['fund_en'][:50]}")
        if re.search(r"\bsilver\b|(^|\s)(ال)?فضة", name) and t not in ("gold", "other"):
            rep.add(f"{s}: silver fund typed as {t}", f"{rid} {r['fund_en'][:50]}")
        if r["fund_en"].strip() == r["fund_ar"].strip() and ARABIC.search(r["fund_en"]) and "—" in r["fund_en"]:
            rep.add(f"{s}: name looks generated, not the real fund name", f"{rid}: {r['fund_en']}")
        if r["currency"] not in ("EGP", "USD", "EUR", ""):
            rep.add(f"{s}: unknown currency", f"{rid}: {r['currency']}")
        if r["currency"] in ("USD", "EUR") and p is not None and p > 1000:
            rep.add(f"{s}: dollar/euro price looks like pounds", f"{rid}: {p} {r['currency']}")
        d = r.get("price_date", "").strip() or r.get("checked_on", "").strip()
        age = days_old(d, today)
        if age is None:
            rep.add(f"{s}: no date", rid)
        elif age > STALE_DAYS["fund"]:
            rep.add(f"{s}: price older than {STALE_DAYS['fund']} days", f"{rid}: {d}")
        if not r["source_url"].startswith("http"):
            rep.add(f"{s}: no source link", rid)
        # A fund named after a brand but filed under another manager.
        for brand, word in [("Thndr", "ثاندر"), ("Beltone", "بلتون"), ("Azimut", "أزيموت"), ("Hermes", "هيرميس"), ("Naeem", "نعيم")]:
            if (word in name or brand.lower() in name) and brand.lower() not in r["manager_en"].lower():
                rep.add(f"{s}: brand in the name differs from the manager", f"{rid} {r['fund_en'][:40]} → filed under {r['manager_en']}")
    if managers is not None and "manager_en" in managers.columns:
        known = set(managers["manager_en"].str.strip())
        for m in sorted(set(active["manager_en"].str.strip()) - known):
            rep.add(f"{s}: manager not in the managers tab", m)
        variants: dict[str, set[str]] = {}
        for m in set(active["manager_en"].str.strip()):
            k = [w for w in re.sub(r"[^a-z ]", "", m.lower()).split() if w not in ("al", "el", "the")]
            variants.setdefault(k[0] if k else m, set()).add(m)
        for k, v in sorted(variants.items()):
            if len(v) > 1:
                rep.add(f"{s}: one manager spelled several ways", " · ".join(sorted(v)))
        used = set(active["manager_en"].str.strip())
        for m in sorted(known - used):
            rep.add(f"{s}: manager with no active funds", m)
    return {"rows": len(df), "active": len(active), "inactive": len(df) - len(active)}


def check_offers(df: pd.DataFrame, rep: Report, today: date, banks: pd.DataFrame | None) -> dict:
    active = df[df["active"].str.upper() == "TRUE"]
    s = "Certificates and bills"
    for i in sorted(set(active["id"][active["id"].duplicated(keep=False)])):
        rep.add(f"{s}: duplicate ids", i)
    key = active[["bank_en", "type", "rate_percent", "rate_kind", "term_months", "payout"]].astype(str).agg("|".join, axis=1)
    for k in sorted(set(key[key.duplicated(keep=False)])):
        rep.add(f"{s}: same product listed twice", k.replace("|", " · "))
    for _, r in active.iterrows():
        rid = r["id"]
        rate = num(r["rate_percent"])
        if rate is None or not (RATE_RANGE[0] <= rate <= RATE_RANGE[1]):
            rep.add(f"{s}: rate missing or out of range", f"{rid}: {r['rate_percent']!r}")
        if r["type"] not in ("certificate", "tbill", "tbond"):
            rep.add(f"{s}: unknown type", f"{rid}: {r['type']}")
        if r["rate_kind"] not in ("fixed", "variable", "stepped"):
            rep.add(f"{s}: unknown rate kind", f"{rid}: {r['rate_kind']}")
        if r["rate_kind"] == "stepped" and not (r.get("rate_note_en", "").strip() or r.get("rate_note_ar", "").strip()):
            rep.add(f"{s}: stepped rate without its steps", rid)
        if r["type"] == "certificate" and not r["term_months"].strip():
            rep.add(f"{s}: certificate without a term", rid)
        if r["payout"] not in ("monthly", "quarterly", "semiannual", "yearly", "maturity", "daily", ""):
            rep.add(f"{s}: unknown payout", f"{rid}: {r['payout']}")
        if r["type"] == "certificate" and not r["payout"]:
            rep.add(f"{s}: certificate without a payout", rid)
        mn = num(r["min_amount"]) if r["min_amount"].strip() else None
        if mn is not None and (mn < 0 or mn > 10_000_000):
            rep.add(f"{s}: odd minimum amount", f"{rid}: {mn}")
        if ARABIC.search(r["name_en"]):
            rep.add(f"{s}: English name is in Arabic", f"{rid}: {r['name_en']}")
        age = days_old(r["checked_on"], today)
        if age is None:
            rep.add(f"{s}: no date", rid)
        elif age > STALE_DAYS["offer"]:
            rep.add(f"{s}: older than {STALE_DAYS['offer']} days", f"{rid}: {r['checked_on']}")
        if not r["source_url"].startswith("http"):
            rep.add(f"{s}: no source link", rid)
        if r.get("currency", "EGP") not in ("EGP", "USD", "EUR", ""):
            rep.add(f"{s}: unknown currency", f"{rid}: {r['currency']}")
    if banks is not None and "bank_en" in banks.columns:
        known = set(banks["bank_en"].str.strip())
        for b in sorted(set(active["bank_en"].str.strip()) - known - {"Central Bank of Egypt", "Ministry of Finance"}):
            rep.add(f"{s}: bank not in the banks tab", b)
    return {"rows": len(df), "active": len(active), "inactive": len(df) - len(active)}


def check_estimates(funds: pd.DataFrame, rep: Report) -> dict:
    p = FIXTURES / "fund_estimates.csv"
    if not p.exists():
        return {}
    est = pd.read_csv(p, dtype=str).fillna("")
    active = funds[funds["active"].str.upper() == "TRUE"]
    ids = set(est["id"])
    missing = [i for i in active["id"] if i not in ids]
    for i in missing:
        rep.add("Fund estimates: active fund missing from the estimates file", i)
    stale = sorted(ids - set(active["id"]))
    for i in stale:
        rep.add("Fund estimates: estimate for a fund that is not active", i)
    return {"estimates": len(est), "missing": len(missing)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheet", action="store_true", help="read the live published sheet")
    ap.add_argument("--today", default=None, help="YYYY-MM-DD (default: newest checked_on in the data)")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    tabs = read_tabs(a.sheet)
    if "funds" not in tabs or "offers" not in tabs:
        print("could not read the funds and offers tabs", file=sys.stderr)
        return 2
    dates = [d for t in ("offers", "funds") for d in tabs[t].get("checked_on", pd.Series(dtype=str)) if d]
    today = date.fromisoformat(a.today) if a.today else max(date.fromisoformat(d[:10]) for d in dates)
    rep = Report()
    f = check_funds(tabs["funds"], rep, today, tabs.get("managers"))
    o = check_offers(tabs["offers"], rep, today, tabs.get("banks"))
    e = check_estimates(tabs["funds"], rep)
    header = [
        "# Scrape integrity report",
        "",
        f"Source: {'live sheet' if a.sheet else 'saved copy (src/lib/data/fixtures)'} · as of {today.isoformat()}",
        "",
        f"- Funds: {f['rows']} rows, {f['active']} active, {f['inactive']} inactive",
        f"- Certificates and bills: {o['rows']} rows, {o['active']} active, {o['inactive']} inactive",
    ]
    if e:
        header.append(f"- Fund estimates: {e['estimates']} rows, {e['missing']} active funds without one")
    text = rep.render(header)
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.exit(main())
