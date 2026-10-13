
from types import SimpleNamespace

import pytest

from app.services.scoring import calculate_final_score


def make_criterion(criterion_id: int, weight: float):
    return SimpleNamespace(id=criterion_id, weight=weight)


def make_result(criterion_id: int, score: int):
    return {
        "criterion_id": criterion_id,
        "score": score,
    }


def test_calculates_weighted_score_with_active_weights():
    criteria = [
        make_criterion(1, 20),
        make_criterion(2, 20),
        make_criterion(3, 15),
        make_criterion(4, 40),
        make_criterion(5, 15),
    ]

    results = [
        make_result(1, 100),
        make_result(2, 100),
        make_result(3, 100),
        make_result(4, 0),
        make_result(5, 100),
    ]

    score = calculate_final_score(criteria, results)

    assert score == 63.64


def test_zero_weight_criterion_is_excluded():
    criteria = [
        make_criterion(1, 20),
        make_criterion(2, 20),
        make_criterion(3, 15),
        make_criterion(4, 0),
        make_criterion(5, 15),
    ]

    results = [
        make_result(1, 100),
        make_result(2, 100),
        make_result(3, 100),
        make_result(4, 0),
        make_result(5, 100),
    ]

    score = calculate_final_score(criteria, results)

    assert score == 100.0


def test_raises_error_when_all_weights_are_zero():
    criteria = [
        make_criterion(1, 0),
        make_criterion(2, 0),
    ]

    results = [
        make_result(1, 100),
        make_result(2, 80),
    ]

    with pytest.raises(ValueError, match="positive weight"):
        calculate_final_score(criteria, results)


def test_raises_error_for_negative_weight():
    criteria = [
        make_criterion(1, 100),
        make_criterion(2, -10),
    ]

    results = [
        make_result(1, 80),
        make_result(2, 90),
    ]

    with pytest.raises(ValueError, match="non-negative"):
        calculate_final_score(criteria, results)
