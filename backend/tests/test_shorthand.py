from decimal import Decimal

import pytest

from app.services.shorthand import ParsedSet, ShorthandError, parse_shorthand


def test_weight_sets_reps():
    assert parse_shorthand("30x2x10") == [ParsedSet(Decimal("30"), 10)] * 2


def test_weight_reps_is_one_set():
    assert parse_shorthand("35x10") == [ParsedSet(Decimal("35"), 10)]


def test_comma_separated_mix_keeps_order():
    assert parse_shorthand("40x10, 80x12, 90x2x10") == [
        ParsedSet(Decimal("40"), 10),
        ParsedSet(Decimal("80"), 12),
        ParsedSet(Decimal("90"), 10),
        ParsedSet(Decimal("90"), 10),
    ]


def test_decimal_weight():
    assert parse_shorthand("62.5x3x8") == [ParsedSet(Decimal("62.5"), 8)] * 3


def test_bodyweight():
    assert parse_shorthand("bwx12") == [ParsedSet(None, 12)]
    assert parse_shorthand("BW x 2 x 15") == [ParsedSet(None, 15)] * 2


@pytest.mark.parametrize("text", ["30 x 2 x 10", "30X2X10", "30×2×10", " 30x2x10 ,", "30x2x10,,"])
def test_tolerates_spacing_case_unicode_times_and_stray_commas(text):
    assert parse_shorthand(text) == [ParsedSet(Decimal("30"), 10)] * 2


@pytest.mark.parametrize(
    "text", ["", "   ", ",", "30", "abc", "30x", "x10", "30x2x10x5", "30x-2x10", "30x1.5x10", "-5x10"]
)
def test_rejects_garbage(text):
    with pytest.raises(ShorthandError):
        parse_shorthand(text)


@pytest.mark.parametrize("text", ["30x0x10", "30x2x0", "30x0"])
def test_rejects_zero_sets_or_reps(text):
    with pytest.raises(ShorthandError, match="at least 1"):
        parse_shorthand(text)


def test_error_names_the_bad_token_and_gives_examples():
    with pytest.raises(ShorthandError) as e:
        parse_shorthand("40x10, oops, 90x2x10")
    assert '"oops"' in str(e.value)
    assert "30x2x10" in str(e.value)
