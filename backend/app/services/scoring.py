from math import isfinite


def calculate_final_score(criteria, results: list[dict]) -> float:
    results_by_id = {
        result["criterion_id"]: result
        for result in results
    }

    active_criteria = []

    for criterion in criteria:
        weight = float(criterion.weight)

        if not isfinite(weight) or weight < 0:
            raise ValueError(
                "Criterion weights must be finite and non-negative."
            )

        if weight > 0:
            active_criteria.append(criterion)

    total_weight = sum(
        float(criterion.weight)
        for criterion in active_criteria
    )

    if total_weight <= 0:
        raise ValueError(
            "At least one criterion must have a positive weight."
        )

    weighted_total = sum(
        results_by_id[criterion.id]["score"]
        * float(criterion.weight)
        for criterion in active_criteria
    )

    return round(weighted_total / total_weight, 2)