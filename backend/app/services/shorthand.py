"""Parse gym shorthand like "30x2x10" into sets. Pure functions: no database, no I/O."""

import re
from dataclasses import dataclass
from decimal import Decimal

EXAMPLES = '"35x10" (35 for 10 reps), "30x2x10" (30 for 2 sets of 10), "40x10, 80x12, 90x2x10", "bwx12" (bodyweight)'

# weight x reps   or   weight x sets x reps. "bw" means bodyweight (no weight).
_TOKEN = re.compile(
    r"^(?P<weight>bw|\d+(?:\.\d+)?)\s*[x×]\s*(?P<a>\d+)(?:\s*[x×]\s*(?P<b>\d+))?$",
    re.IGNORECASE,
)


class ShorthandError(ValueError):
    """The text isn't valid shorthand. The message says what was wrong and how to fix it."""


@dataclass(frozen=True)
class ParsedSet:
    weight: Decimal | None  # None = bodyweight
    reps: int


def parse_shorthand(text: str) -> list[ParsedSet]:
    """"40x10, 80x12, 90x2x10" -> 4 sets, in the order written."""
    tokens = [t.strip() for t in text.split(",") if t.strip()]
    if not tokens:
        raise ShorthandError(f"Empty shorthand. Examples: {EXAMPLES}.")

    sets: list[ParsedSet] = []
    for token in tokens:
        m = _TOKEN.match(token)
        if not m:
            raise ShorthandError(
                f'Could not read "{token}". Use weight x reps or weight x sets x reps. Examples: {EXAMPLES}.'
            )
        weight = None if m["weight"].lower() == "bw" else Decimal(m["weight"])
        if m["b"] is None:
            count, reps = 1, int(m["a"])
        else:
            count, reps = int(m["a"]), int(m["b"])
        if count < 1 or reps < 1:
            raise ShorthandError(f'"{token}": sets and reps must be at least 1.')
        sets.extend(ParsedSet(weight, reps) for _ in range(count))
    return sets
