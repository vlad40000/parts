from services.extraction.pipeline import (
    initial_assignments,
    merge_audit_into_sections,
    normalize_expected_count,
    to_scaffold_payload,
)


def test_exact_model_source_totals_override_reference_label_sum():
    expected, meta = normalize_expected_count({
        "expected_parts_count": 2656,
        "confidence": "high",
        "basis": "cross_referenced",
        "source_totals": [
            {
                "source": "Sears PartsDirect",
                "count": 85,
                "url": "https://www.searspartsdirect.com/",
                "evidence": "85 parts",
            },
            {
                "source": "Encompass",
                "count": 94,
                "url": "https://encompass.com/search?searchTerm=PTW905BPT0DG",
                "evidence": "94 parts",
            },
        ],
    })

    assert expected == 94
    assert meta["credible_source_range"] == {"minimum": 85, "maximum": 94}
    assert meta["rejected_expected_parts_count"] == 2656
    assert meta["selection_basis"] == "source_totals"


def test_implausible_unverified_total_becomes_unknown():
    expected, meta = normalize_expected_count({
        "expected_parts_count": 2656,
        "confidence": "low",
        "basis": "diagram_callouts",
    })

    assert expected == 0
    assert meta["rejected_expected_parts_count"] == 2656
    assert meta["selection_basis"] == "unknown"


def test_counted_diagram_rows_are_summed_when_sources_are_unavailable():
    expected, meta = normalize_expected_count({
        "expected_parts_count": 90,
        "confidence": "medium",
        "basis": "diagram_callouts",
        "per_section_counts": [
            {"section_name": "Tub & Motor", "count": 31},
            {"section_name": "Controls", "count": 19},
            {"section_name": "Cabinet", "count": 14},
            {"section_name": "Top & Lid", "count": 21},
        ],
    })

    assert expected == 85
    assert meta["selection_basis"] == "counted_diagram_rows"


def test_audit_requires_model_specific_url_evidence():
    sections = {"sections": [{"section_name": "Tub & Motor"}]}
    audits = [{
        "missing_sections": [
            {"section_name": "Dispenser Assembly", "page_url": None, "diagram_url": None},
            {
                "section_name": "Controls",
                "page_url": "https://example.com/PTW905BPT0DG/controls",
                "diagram_url": None,
            },
        ]
    }]

    merged = merge_audit_into_sections(sections, audits)

    assert [section["section_name"] for section in merged["sections"]] == [
        "Tub & Motor",
        "Controls",
    ]


def test_initial_assignments_do_not_create_empty_workers():
    sections = {
        "sections": [
            {"section_name": "Tub & Motor"},
            {"section_name": "Controls"},
            {"section_name": "Cabinet"},
            {"section_name": "Top & Lid"},
        ]
    }

    assignments = initial_assignments(sections)

    assert len(assignments) == 4
    assert all(assignment["target_sections"] for assignment in assignments)


def test_scaffold_payload_preserves_expected_count_evidence():
    payload = to_scaffold_payload({
        "nameplate": {"model_number": "PTW905BPT0DG"},
        "sections": [],
        "parts": [],
        "parts_found": 0,
        "expected_parts_count": 94,
        "expected_count_meta": {
            "credible_source_range": {"minimum": 85, "maximum": 94},
        },
    }, "job_test")

    assert payload["expected_parts_count"] == 94
    assert payload["expected_count_meta"]["credible_source_range"] == {
        "minimum": 85,
        "maximum": 94,
    }
