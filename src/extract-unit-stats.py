#!/usr/bin/env python3
"""
Extracts per-unit stats from the BAR /units Lua definitions and writes a JSON
file keyed by unit definition name with:

  cost : metalcost + energycost/60
  hp   : health
  dam  : the highest damage value across all of the unit's weapons

Only the fields above are needed, but we parse the full table literal so the
values are pulled from the correct scope (unit top-level vs. weapondefs vs.
featuredefs/wreckage), avoiding false positives.
"""

import json
import os
import re
import sys

UNITS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "units")
OUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "unit-stats.json")


# ---------------------------------------------------------------------------
# Minimal Lua table-literal parser (no external deps).
# Handles: numbers, strings ("", '', [[ ]]), booleans, nil, nested tables,
# `name = value`, `[expr] = value`, and bare array entries. Comments are
# stripped first.
# ---------------------------------------------------------------------------

def strip_comments(src):
    out = []
    i, n = 0, len(src)
    while i < n:
        if src.startswith("--[[", i):
            end = src.find("]]", i + 4)
            i = n if end == -1 else end + 2
        elif src.startswith("--", i):
            end = src.find("\n", i)
            i = n if end == -1 else end + 1
        else:
            out.append(src[i])
            i += 1
    return "".join(out)


TOKEN_RE = re.compile(r"""
    (?P<ws>\s+)
  | (?P<comment>--)
  | (?P<number>[-+]?\d+\.?\d*(?:[eE][-+]?\d+)?|0[xX][0-9a-fA-F]+)
  | (?P<string>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')
  | (?P<longstring>\[\[.*?\]\])
  | (?P<ident>[A-Za-z_][A-Za-z0-9_]*)
  | (?P<punct>[{}[\]=,;])
""", re.VERBOSE | re.DOTALL)


def tokenize(src):
    src = strip_comments(src)
    tokens = []
    pos = 0
    while pos < len(src):
        m = TOKEN_RE.match(src, pos)
        if not m:
            pos += 1
            continue
        kind = m.lastgroup
        if kind == "ws":
            pass
        elif kind == "comment":
            # long-form safety: handled by strip_comments already
            pass
        else:
            tokens.append((kind, m.group(kind)))
        pos = m.end()
    return tokens


class LuaValue:
    """Wrapper so we can distinguish a Lua nil/absent key from a Python one."""
    def __init__(self, kind, value):
        self.kind = kind
        self.value = value

    def __repr__(self):
        return f"{self.kind}:{self.value!r}"


class Parser:
    def __init__(self, tokens):
        self.toks = tokens
        self.i = 0

    def peek(self, kind=None):
        if self.i >= len(self.toks):
            return None
        k, v = self.toks[self.i]
        return v if kind is None or k == kind else None

    def expect(self, kind):
        """kind is a token kind ('number','string',...) OR a punct char ('{')."""
        if self.i >= len(self.toks):
            raise ValueError("unexpected end of input")
        k, v = self.toks[self.i]
        if k == "punct":
            if kind != v:
                raise ValueError(f"expected {kind}, got {k}: {v!r}")
        elif k != kind:
            raise ValueError(f"expected {kind}, got {k}: {v!r}")
        self.i += 1
        return v

    def skip(self):
        self.i += 1

    def parse_value(self):
        """Returns a LuaValue. Handles tables, scalars, and identifiers."""
        t = self.peek()
        if t is None:
            raise ValueError("unexpected end of input")
        k, v = self.toks[self.i]

        if k == "punct" and v == "{":
            return self.parse_table()  # return the raw dict, not a wrapper
        if k == "number":
            self.i += 1
            if v.lower().startswith("0x"):
                return LuaValue("number", int(v, 16))
            return LuaValue("number", float(v))
        if k == "string":
            self.i += 1
            return LuaValue("string", v[1:-1])
        if k == "longstring":
            self.i += 1
            return LuaValue("string", v[2:-2])
        if k == "ident":
            self.i += 1
            if v == "true":
                return LuaValue("bool", True)
            if v == "false":
                return LuaValue("bool", False)
            if v == "nil":
                return LuaValue("nil", None)
            return LuaValue("ident", v)  # e.g. a reference we don't care about
        if k == "punct" and v == "[":
            return self.parse_bracketed()
        if k == "punct" and v == "-":
            self.i += 1
            val = self.parse_value()
            if val.kind == "number":
                return LuaValue("number", -val.value)
            return val
        raise ValueError(f"unexpected token {k}:{v!r}")

    def parse_bracketed(self):
        # [ <expr> ] = value  -- evaluate index but only keep it when it's a number
        self.expect("[")
        idx = self.parse_value()
        self.expect("]")
        self.expect("=")
        val = self.parse_value()
        key = int(idx.value) if idx.kind == "number" else None
        return ("bracket", key, val)

    def parse_table(self):
        self.expect("{")
        d = {}
        seq = []
        next_seq = 1
        while True:
            t = self.peek()
            if t is None:
                raise ValueError("unterminated table")
            if t == "}":
                self.skip()
                break

            # Lookahead: is this `key = value`?
            if self.i + 2 < len(self.toks) and self.toks[self.i + 1][1] == "=" \
                    and self.toks[self.i][0] == "ident":
                key = self.toks[self.i][1]
                self.i += 2
                val = self.parse_value()
                d[key] = val
            elif t == "[":
                res = self.parse_bracketed()
                if res[0] == "bracket" and res[1] is not None:
                    d[res[1]] = res[2]
                else:
                    val = res[2]
                    d[str(len(d) + len(seq))] = val
            else:
                val = self.parse_value()
                # position in sequence (implicit array entry)
                seq.append(val)

            # optional trailing separator
            nxt = self.peek()
            if nxt == "," or nxt == ";":
                self.skip()

        if seq:
            d["__seq"] = seq
        return d


def parse_lua(text):
    tokens = tokenize(text)
    p = Parser(tokens)
    # Skip leading statements (e.g. `local unitName = "..."`) up to the first
    # `return`, then parse the returned expression.
    while p.i < len(p.toks):
        k, v = p.toks[p.i]
        if k == "ident" and v == "return":
            p.i += 1
            return p.parse_value()
        p.i += 1
    raise ValueError("no return statement found")

def to_num(lv):
    if lv is None:
        return 0.0
    if isinstance(lv, LuaValue) and lv.kind == "number":
        return lv.value
    return 0.0


def collect_numbers_in_table(tbl, out):
    """Recursively collect numeric leaf values from a parsed table."""
    if not isinstance(tbl, dict):
        return
    for k, v in tbl.items():
        if k == "__seq":
            for item in v:
                if isinstance(item, dict):
                    collect_numbers_in_table(item, out)
                elif isinstance(item, LuaValue) and item.kind == "number":
                    out.append(item.value)
            continue
        if isinstance(v, dict):
            collect_numbers_in_table(v, out)
        elif isinstance(v, LuaValue) and v.kind == "number":
            out.append(v.value)


def unit_stats(unit_tbl):
    """Given a parsed unit table dict, return {cost, hp, dam} or None."""
    if not isinstance(unit_tbl, dict):
        return None

    hp = to_num(unit_tbl.get("health"))
    metal = to_num(unit_tbl.get("metalcost"))
    energy = to_num(unit_tbl.get("energycost"))
    cost = metal + energy / 60.0

    dam = 0.0
    wd = unit_tbl.get("weapondefs")
    if isinstance(wd, dict):
        for wk, wv in wd.items():
            if wk == "__seq":
                continue
            if not isinstance(wv, dict):
                continue
            dmg = wv.get("damage")
            if isinstance(dmg, dict):
                vals = []
                collect_numbers_in_table(dmg, vals)
                if vals:
                    dam = max(dam, max(vals))

    return {
        "cost": round(cost, 2),
        "hp": int(round(hp)),
        "dam": int(round(dam)),
    }


def main():
    result = {}
    errors = []
    lua_files = []
    for root, dirs, files in os.walk(UNITS_DIR):
        for fname in files:
            if fname.endswith(".lua"):
                lua_files.append(os.path.join(root, fname))

    for path in sorted(lua_files):
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        try:
            root = parse_lua(text)
        except Exception as e:  # noqa: BLE001
            errors.append((os.path.relpath(path, UNITS_DIR), f"parse: {e}"))
            continue

        if isinstance(root, LuaValue) and root.kind == "table":
            tbl = root.value
        elif isinstance(root, dict):
            tbl = root
        else:
            errors.append((os.path.relpath(path, UNITS_DIR), "not a table root"))
            continue

        # The return table is keyed by the unit definition name -> unit table.
        # Some files define a single unit; take every table-valued top-level key.
        for key, val in tbl.items():
            if key == "__seq":
                continue
            if not isinstance(val, dict):
                continue
            stats = unit_stats(val)
            if stats is None:
                continue
            # Avoid overwriting with identical smaller data; prefer existing.
            result.setdefault(key, stats)

    # Sort keys for stable output
    result = dict(sorted(result.items()))

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(result)} units to {OUT_FILE}")
    if errors:
        print(f"{len(errors)} file(s) had errors (first 20):")
        for rel, err in errors[:20]:
            print(f"  {rel}: {err}")


if __name__ == "__main__":
    main()