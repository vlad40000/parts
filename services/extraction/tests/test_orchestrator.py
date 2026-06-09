import pytest
from unittest.mock import patch, MagicMock

# Import the orchestrator components
from services.extraction.pipeline import run_pipeline_fast, MAX_ROUNDS

@pytest.fixture
def mock_dependencies():
    with patch("services.extraction.pipeline.step1_nameplate") as m_s1, \
         patch("services.extraction.pipeline.step2_find_diagrams") as m_s2, \
         patch("services.extraction.pipeline.step3_consolidate") as m_s3, \
         patch("services.extraction.pipeline.step4_audit") as m_s4, \
         patch("services.extraction.pipeline.step5_expected_count") as m_s5, \
         patch("services.extraction.pipeline.step7_gameplan") as m_s7, \
         patch("services.extraction.pipeline._parallel") as m_parallel:
        
        # Setup default mock returns to pass the initial steps
        m_s1.return_value = {"model_number": "TEST1234"}
        m_s2.return_value = []
        m_s3.return_value = {"sections": [{"section_name": "Drum"}, {"section_name": "Motor"}]}
        m_s4.return_value = []
        m_s5.return_value = {"expected_parts_count": 10}
        
        yield m_parallel, m_s7


def test_saturation_exit(mock_dependencies):
    m_parallel, m_s7 = mock_dependencies
    
    def parallel_side_effect(jobs):
        parallel_side_effect.calls += 1
        return [{"parts": []} for _ in jobs]
    parallel_side_effect.calls = 0
    m_parallel.side_effect = parallel_side_effect
    
    def gameplan_side_effect(*args, **kwargs):
        call_idx = gameplan_side_effect.calls
        gameplan_side_effect.calls += 1
        return {"assignments": [{"worker_id": "W1", "target_sections": [f"NewSection_{call_idx}"]}]}
    gameplan_side_effect.calls = 0
    m_s7.side_effect = gameplan_side_effect
    
    result = run_pipeline_fast(timeout_seconds=9999, model_number="TEST")
    
    # Loop should exit after round 2 (STALL_ROUNDS)
    assert parallel_side_effect.calls == 2
    assert m_s7.call_count == 1


def test_completion_exit(mock_dependencies):
    m_parallel, m_s7 = mock_dependencies
    
    # 1st round: returns exactly the expected parts (10)
    parts = [
        {
            "section": "Drum",
            "manufacturer_part_number": f"PART{i}",
            "part_name": f"Part {i}",
            "part_number_status": "confirmed"
        }
        for i in range(10)
    ]
    m_parallel.return_value = [{"parts": parts}]
    
    result = run_pipeline_fast(timeout_seconds=9999, model_number="TEST")
    
    # Loop should exit after round 1 due to reaching expected count
    assert m_parallel.call_count == 1
    assert m_s7.call_count == 0


def test_round_cap_exit(mock_dependencies):
    m_parallel, m_s7 = mock_dependencies
    
    # We want it to run MAX_ROUNDS. To prevent saturation exit, we must add at least 1 part each round.
    # But to prevent completion exit, we must stay below expected count (10).
    def parallel_side_effect(jobs):
        call_idx = parallel_side_effect.calls
        parallel_side_effect.calls += 1
        return [{"parts": [{
            "section": f"Section_{call_idx}",
            "manufacturer_part_number": f"PART_{call_idx}",
            "part_name": "Part",
            "part_number_status": "confirmed"
        }]}]
    parallel_side_effect.calls = 0
    m_parallel.side_effect = parallel_side_effect
    
    def gameplan_side_effect(*args, **kwargs):
        call_idx = gameplan_side_effect.calls
        gameplan_side_effect.calls += 1
        return {"assignments": [{"worker_id": "W1", "target_sections": [f"Section_{call_idx+1}"]}]}
    gameplan_side_effect.calls = 0
    m_s7.side_effect = gameplan_side_effect
    
    result = run_pipeline_fast(timeout_seconds=9999, model_number="TEST")
    
    assert m_parallel.call_count == MAX_ROUNDS
    assert m_s7.call_count == MAX_ROUNDS - 1


def test_all_lanes_fail_does_not_trigger_saturation(mock_dependencies):
    m_parallel, m_s7 = mock_dependencies
    
    def parallel_side_effect(jobs):
        call_idx = parallel_side_effect.calls
        parallel_side_effect.calls += 1
        if call_idx == 0:
            return [{"_error": "Timeout"} for _ in jobs]
        return [{"parts": []} for _ in jobs]
    parallel_side_effect.calls = 0
    m_parallel.side_effect = parallel_side_effect
    
    def gameplan_side_effect(*args, **kwargs):
        call_idx = gameplan_side_effect.calls
        gameplan_side_effect.calls += 1
        return {"assignments": [{"worker_id": "W1", "target_sections": [f"Section_{call_idx}"]}]}
    gameplan_side_effect.calls = 0
    m_s7.side_effect = gameplan_side_effect
    
    result = run_pipeline_fast(timeout_seconds=9999, model_number="TEST")
    
    # Should run 3 rounds. Round 1 doesn't exit because success_count == 0.
    assert parallel_side_effect.calls == 3
    assert m_s7.call_count == 2


def test_failed_lane_stays_assignable_next_round(mock_dependencies):
    m_parallel, m_s7 = mock_dependencies
    
    def parallel_side_effect(jobs):
        call_idx = parallel_side_effect.calls
        parallel_side_effect.calls += 1
        if call_idx == 0:
            return [{"_error": "Timeout"} for _ in jobs]
        return [{"parts": []} for _ in jobs]
    parallel_side_effect.calls = 0
    m_parallel.side_effect = parallel_side_effect
    
    m_s7.return_value = {"assignments": [{"worker_id": "W1", "target_sections": ["Drum"]}]}
    
    result = run_pipeline_fast(timeout_seconds=9999, model_number="TEST")
    
    assert m_s7.call_count > 0
    args, kwargs = m_s7.call_args_list[0]
    past_covered = args[5]
    
    assert "Drum" not in past_covered
    assert len(past_covered) == 0


@patch("services.extraction.pipeline.initial_assignments")
def test_overlap_filter_detail(m_init, mock_dependencies):
    m_parallel, m_s7 = mock_dependencies
    
    m_init.return_value = [{"worker_id": "W1", "target_sections": ["Drum"]}]
    
    def parallel_side_effect(jobs):
        call_idx = parallel_side_effect.calls
        parallel_side_effect.calls += 1
        if call_idx == 0:
            return [{"parts": [{"section": "Drum", "manufacturer_part_number": "P1", "part_number_status": "confirmed"}]}]
        return [{"parts": []} for _ in jobs]
    parallel_side_effect.calls = 0
    
    m_s7.side_effect = [
        {"assignments": [
            {"worker_id": "W1", "target_sections": ["Drum", "Motor"]}, # Drum is covered, Motor is new
            {"worker_id": "W2", "target_sections": ["Motor", "Other"]}  # Motor is already assigned to W1 above, Other is new
        ]},
        {"assignments": [
            {"worker_id": "W1", "target_sections": ["NewOne"]}
        ]}
    ]
    
    captured_assignments = []
    
    def inspecting_parallel(jobs):
        for job in jobs:
            a = job.__defaults__[0]
            captured_assignments.append(a)
        
        return parallel_side_effect(jobs)
        
    m_parallel.side_effect = inspecting_parallel
    
    run_pipeline_fast(timeout_seconds=9999, model_number="TEST")
    
    round2_assignments = captured_assignments[1:3]
    
    assert len(round2_assignments) == 2
    assert round2_assignments[0]["worker_id"] == "W1"
    assert round2_assignments[0]["target_sections"] == ["Motor"]
    
    assert round2_assignments[1]["worker_id"] == "W2"
    assert round2_assignments[1]["target_sections"] == ["Other"]
