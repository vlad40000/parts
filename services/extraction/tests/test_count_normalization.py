from services.extraction.pipeline import (
    consolidate_diagram_results,
    initial_assignments,
    merge_audit_into_sections,
    normalize_expected_count,
    to_scaffold_payload,
)


def test_fast_consolidation_preserves_counts_separately_from_reference_labels():
    sections = consolidate_diagram_results([
        {
            "diagrams": [{
                "section_name": "Tub & Motor",
                "diagram_url": "https://example.com/tub.png",
                "page_url": "https://example.com/model/tub",
                "distinct_callout_count_seen": 31,
                "max_reference_label_seen": "824",
            }]
        },
        {
            "diagrams": [{
                "section_name": "T U B & M O T O R",
                "diagram_url": "https://example.com/tub.png",
                "page_url": "https://example.com/model/tub",
                "distinct_callout_count_seen": 29,
                "max_reference_label_seen": "824",
            }]
        },
    ])

    assert sections["sections"] == [{
        "section_name": "Tub & Motor",
        "aliases": ["T U B & M O T O R"],
        "diagram_urls": ["https://example.com/tub.png"],
        "page_urls": ["https://example.com/model/tub"],
        "observed_part_count": 31,
        "max_reference_label": "824",
    }]


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


def test_diagram_occurrences_are_not_used_as_unique_part_target():
    expected, meta = normalize_expected_count({
        "expected_parts_count": 101,
        "confidence": "medium",
        "basis": "diagram_callouts",
        "per_section_counts": [
            {"section_name": "Tub & Motor", "count": 38},
            {"section_name": "Controls", "count": 20},
            {"section_name": "Cabinet", "count": 9},
            {"section_name": "Top & Lid", "count": 34},
        ],
    })

    assert expected == 0
    assert meta["diagram_occurrence_total"] == 101
    assert meta["rejected_expected_parts_count"] == 101
    assert meta["selection_basis"] == "unknown"


def test_untrusted_distributor_total_is_evidence_not_unique_target():
    expected, meta = normalize_expected_count({
        "expected_parts_count": 101,
        "confidence": "high",
        "basis": "source_total",
        "source_totals": [{
            "source": "Parts Dr",
            "count": 101,
            "url": "https://partsdr.com/model/ge-ptw905bpt0dg-parts-diagrams",
            "evidence": "Four diagram totals sum to 101",
        }],
    })

    assert expected == 0
    assert meta["source_totals"] == []
    assert meta["rejected_source_totals"][0]["count"] == 101


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
